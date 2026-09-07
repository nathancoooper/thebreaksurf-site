#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const temp = await mkdtemp(path.join(os.tmpdir(), 'tbs-media-helper-'));
const port = 47832;
const helperHome = path.join(temp, 'helper');
const dcim = path.join(temp, 'DCIM');
await mkdir(helperHome, { recursive: true });
await mkdir(dcim, { recursive: true });

await execFileAsync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes',
  '-keyout', path.join(helperHome, 'localhost.key'),
  '-out', path.join(helperHome, 'localhost.crt'),
  '-days', '1',
  '-subj', '/CN=localhost',
  '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
]);

const videoBytes = Buffer.from('mock-video-payload-for-range-verification');
await writeFile(path.join(dcim, 'DJI_20260713090147_0296_D.MP4'), videoBytes);
await writeFile(path.join(dcim, 'DJI_20260713090147_0296_D.LRF'), 'proxy');
await writeFile(path.join(dcim, 'IMG_20260713101530.DNG'), 'raw');

const helperPath = path.join(import.meta.dirname, 'helper.mjs');
const child = (await import('node:child_process')).spawn(process.execPath, [helperPath], {
  env: {
    ...process.env,
    TBS_MEDIA_HELPER_HOME: helperHome,
    TBS_MEDIA_HELPER_TEST_ROOT: dcim,
    TBS_MEDIA_HELPER_TEST_AUTO_PAIR: '1',
    TBS_MEDIA_HELPER_TEST_ROTATE: '1',
    TBS_MEDIA_HELPER_PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let helperStderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { helperStderr += chunk; });

const origin = 'https://admin.test';
const agent = new https.Agent({ rejectUnauthorized: false });

function request(route, { method = 'GET', token = '', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'localhost',
      port,
      path: route,
      method,
      agent,
      headers: {
        Origin: origin,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = response.headers['content-type'] ?? '';
        const value = contentType.includes('application/json') ? JSON.parse(buffer.toString()) : buffer;
        if ((response.statusCode ?? 500) >= 400) reject(new Error(value.error ?? `HTTP ${response.statusCode}`));
        else resolve({ status: response.statusCode, headers: response.headers, value });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const health = await request('/health');
      if (health.value.ok) break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (attempt === 49) throw new Error(`Helper did not start.${helperStderr.trim() ? ` ${helperStderr.trim()}` : ''}`);
  }

  const paired = await request('/pair', { method: 'POST' });
  const token = paired.value.token;
  assert.ok(token);

  const picked = await request('/pick', { method: 'POST', token });
  assert.equal(picked.value.moveCount, 2);
  assert.equal(picked.value.trashCount, 1);

  await request('/organise', { method: 'POST', token });
  let completed;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const status = await request('/job', { token });
    if (!status.value.job.running) {
      completed = status.value;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(completed.job.phase, 'complete');
  assert.equal(completed.days.length, 1);

  const day = completed.days[0];
  const videos = await request(`/videos?day=${encodeURIComponent(day.key)}`, { token });
  assert.equal(videos.value.videos.length, 1);
  const video = videos.value.videos[0];
  assert.equal(video.captured, false);

  const allVideos = await request('/videos/all', { token });
  assert.equal(allVideos.value.videos.length, 1);
  assert.equal(allVideos.value.videos[0].relativePath, path.join(...day.key.split('/'), video.name));

  const range = await request(`/media/${video.id}?token=${encodeURIComponent(token)}`, {
    token,
    headers: { Range: 'bytes=0-3' },
  });
  assert.equal(range.status, 206);
  assert.deepEqual(range.value, videoBytes.subarray(0, 4));

  const rotated = await request(`/video/${video.id}/rotate`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ degrees: 90 }),
  });
  const rotationEvents = rotated.value.toString().trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rotationEvents.at(-1).complete, true);
  assert.equal(rotationEvents.at(-1).video.id, video.id);
  assert.deepEqual(await readFile(path.join(dcim, ...video.relativePath.split('/'))), videoBytes);

  const captureName = '2026-07-13_100000-123_RAW.jpg';
  const captureBytes = Buffer.from('jpeg-test');
  const capture = await request('/capture', {
    method: 'POST',
    token,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': captureBytes.length,
      'X-TBS-Day': day.key,
      'X-TBS-Filename': captureName,
    },
    body: captureBytes,
  });
  const capturePath = path.join(dcim, ...day.key.split('/'), capture.value.filename);
  assert.deepEqual(await readFile(capturePath), captureBytes);

  await request(`/video/${video.id}/captured`, { method: 'POST', token });
  const capturedVideos = await request(`/videos?day=${encodeURIComponent(day.key)}`, { token });
  assert.equal(capturedVideos.value.videos[0].captured, true);

  const deleted = await request(`/video/${video.id}`, { method: 'DELETE', token });
  assert.match(deleted.value.message, /moved to Trash/);
  await assert.rejects(stat(path.join(dcim, ...video.relativePath.split('/'))));
  const remainingVideos = await request('/videos/all', { token });
  assert.equal(remainingVideos.value.videos.length, 0);

  const trashEntries = await readdir(path.join(dcim, '.Test Trash'));
  assert.equal(trashEntries.length, 3);
  assert.equal((await stat(capturePath)).size, captureBytes.length);
  console.log('Media helper integration test passed.');
} finally {
  child.kill('SIGTERM');
}
