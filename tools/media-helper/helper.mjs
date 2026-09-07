#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  open,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const VERSION = '1.2.0';
const PORT = Number(process.env.TBS_MEDIA_HELPER_PORT || 47831);
const APP_SUPPORT = process.env.TBS_MEDIA_HELPER_HOME
  || path.join(os.homedir(), 'Library', 'Application Support', 'The Break Surf Media Helper');
const CONFIG_PATH = path.join(APP_SUPPORT, 'config.json');
const CERT_PATH = path.join(APP_SUPPORT, 'localhost.crt');
const KEY_PATH = path.join(APP_SUPPORT, 'localhost.key');
const TRASH_TOOL_PATH = path.join(APP_SUPPORT, 'trash-file');
const ROTATE_TOOL_PATH = path.join(APP_SUPPORT, 'rotate-video');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MEDIA_EXTENSIONS = new Set(['3gp', 'aac', 'arw', 'avi', 'cr2', 'cr3', 'dng', 'gif', 'heic', 'heif', 'insv', 'jpeg', 'jpg', 'm2ts', 'm4a', 'm4v', 'mkv', 'mov', 'mp3', 'mp4', 'mts', 'nef', 'ogg', 'orf', 'png', 'raf', 'raw', 'rw2', 'srt', 'thm', 'tif', 'tiff', 'wav', 'webm', 'webp']);
const VIDEO_EXTENSIONS = new Set(['3gp', 'avi', 'insv', 'm2ts', 'm4v', 'mkv', 'mov', 'mp4', 'mts', 'webm']);
const RAW_EXTENSIONS = new Set(['arw', 'cr2', 'cr3', 'dng', 'nef', 'orf', 'raf', 'raw', 'rw2']);
const AUDIO_EXTENSIONS = new Set(['aac', 'm4a', 'mp3', 'ogg', 'wav']);
const CAPTURE_MARKER_SUFFIX = '.tbs-frame-captures.json';

await mkdir(APP_SUPPORT, { recursive: true });

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return { clients: {} };
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return { clients: parsed.clients && typeof parsed.clients === 'object' ? parsed.clients : {} };
  } catch {
    return { clients: {} };
  }
}

const config = loadConfig();
let rootPath = null;
let preview = null;
let caffeinateProcess = null;
let stopRequested = false;
let job = idleJob('Ready');
let rotationRunning = false;

function idleJob(message) {
  return {
    phase: 'idle',
    message,
    running: false,
    stopping: false,
    completed: 0,
    total: 0,
    bytesCompleted: 0,
    bytesTotal: 0,
    currentFile: '',
    currentFileBytes: 0,
    startedAt: null,
    finishedAt: null,
    error: '',
  };
}

function saveConfig() {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function extension(name) {
  return path.extname(name).slice(1).toLowerCase();
}

function captureMarkerPath(videoPath) {
  return path.join(path.dirname(videoPath), `.${path.basename(videoPath)}${CAPTURE_MARKER_SUFFIX}`);
}

function ordinal(value) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
}

function folderParts(date) {
  const month = date.getMonth() + 1;
  return [String(date.getFullYear()), `${String(month).padStart(2, '0')} - ${MONTHS[month - 1]}`, ordinal(date.getDate())];
}

function captureBasename(date) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function validLocalDate(values) {
  const [year, month, day, hour, minute, second, millisecond = 0] = values;
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function dateFromFilename(name) {
  const separated = name.match(/((?:19|20)\d{2})-([01]\d)-([0-3]\d)[_T -]([0-2]\d)([0-5]\d)([0-5]\d)(?:[-_.](\d{3}))?/);
  if (separated) return validLocalDate(separated.slice(1).map(Number));
  const compact = name.match(/((?:19|20)\d{2})([01]\d)([0-3]\d)([0-2]\d)([0-5]\d)([0-5]\d)/);
  if (!compact) return null;
  const values = compact.slice(1).map(Number);
  return /^DJI[_-]/i.test(name)
    ? new Date(Date.UTC(values[0], values[1] - 1, values[2], values[3], values[4], values[5]))
    : validLocalDate(values);
}

function parseTiff(buffer) {
  if (buffer.length < 8) return null;
  const little = buffer[0] === 0x49 && buffer[1] === 0x49;
  const big = buffer[0] === 0x4d && buffer[1] === 0x4d;
  if (!little && !big) return null;
  const uint16 = offset => little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const uint32 = offset => little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  const values = new Map();
  const visited = new Set();
  const readIfd = offset => {
    if (visited.has(offset) || offset < 0 || offset + 2 > buffer.length) return;
    visited.add(offset);
    const count = uint16(offset);
    for (let index = 0; index < count; index += 1) {
      const position = offset + 2 + index * 12;
      if (position + 12 > buffer.length) break;
      const tag = uint16(position);
      const type = uint16(position + 2);
      const countValue = uint32(position + 4);
      const dataOffset = countValue <= 4 ? position + 8 : uint32(position + 8);
      if (type === 2 && dataOffset + countValue <= buffer.length) {
        values.set(tag, buffer.subarray(dataOffset, dataOffset + Math.max(0, countValue - 1)).toString('utf8'));
      }
      if (tag === 0x8769) readIfd(uint32(position + 8));
    }
  };
  readIfd(uint32(4));
  const timestamp = values.get(0x9003) ?? values.get(0x0132);
  const description = values.get(0x010e) ?? '';
  if (!timestamp) return { date: null, description };
  const found = timestamp.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!found) return { date: null, description };
  const subsecond = (values.get(0x9291) ?? '0').padEnd(3, '0').slice(0, 3);
  const zone = values.get(0x9011) ?? values.get(0x9010) ?? '';
  const iso = `${found[1]}-${found[2]}-${found[3]}T${found[4]}:${found[5]}:${found[6]}.${subsecond}${zone}`;
  const date = zone ? new Date(iso) : validLocalDate([...found.slice(1).map(Number), Number(subsecond)]);
  return { date: date && !Number.isNaN(date.getTime()) ? date : null, description };
}

async function embeddedImageMetadata(filePath, fileSize) {
  const handle = await open(filePath, 'r');
  try {
    const length = Math.min(fileSize, 8 * 1024 * 1024);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let position = 2;
      while (position + 4 <= buffer.length && buffer[position] === 0xff) {
        const marker = buffer[position + 1];
        if (marker === 0xda || marker === 0xd9) break;
        const segmentLength = buffer.readUInt16BE(position + 2);
        if (marker === 0xe1 && buffer.subarray(position + 4, position + 10).toString() === 'Exif\0\0') {
          return parseTiff(buffer.subarray(position + 10, position + 2 + segmentLength));
        }
        position += 2 + segmentLength;
      }
    }
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => buffer[index] === value);
    if (pngSignature) {
      let position = 8;
      while (position + 12 <= buffer.length) {
        const chunkLength = buffer.readUInt32BE(position);
        const type = buffer.subarray(position + 4, position + 8).toString();
        if (type === 'eXIf') return parseTiff(buffer.subarray(position + 8, position + 8 + chunkLength));
        position += chunkLength + 12;
      }
    }
    if ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4d && buffer[1] === 0x4d)) return parseTiff(buffer);
    return null;
  } finally {
    await handle.close();
  }
}

const QUICKTIME_EPOCH_SECONDS = 2_082_844_800;
const QUICKTIME_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'ilst']);

function quickTimeAtoms(buffer, start, end) {
  const found = [];
  let position = start;
  while (position + 8 <= end) {
    let atomSize = buffer.readUInt32BE(position);
    const type = buffer.subarray(position + 4, position + 8).toString();
    let headerSize = 8;
    if (atomSize === 1 && position + 16 <= end) {
      atomSize = Number(buffer.readBigUInt64BE(position + 8));
      headerSize = 16;
    } else if (atomSize === 0) {
      atomSize = end - position;
    }
    if (atomSize < headerSize || position + atomSize > end) break;
    found.push({ type, start: position, dataStart: position + headerSize, end: position + atomSize });
    position += atomSize;
  }
  return found;
}

function quickTimeDescendants(buffer, parent) {
  const output = [];
  const walk = (start, end) => {
    for (const atom of quickTimeAtoms(buffer, start, end)) {
      output.push(atom);
      if (QUICKTIME_CONTAINERS.has(atom.type)) walk(atom.dataStart, atom.end);
      if (atom.type === 'meta') walk(atom.dataStart + 4, atom.end);
    }
  };
  walk(parent.dataStart, parent.end);
  return output;
}

async function quickTimeMetadata(filePath, fileSize) {
  const handle = await open(filePath, 'r');
  try {
    let position = 0;
    while (position + 8 <= fileSize) {
      const header = Buffer.alloc(Math.min(16, fileSize - position));
      await handle.read(header, 0, header.length, position);
      if (header.length < 8) return null;
      let atomSize = header.readUInt32BE(0);
      const type = header.subarray(4, 8).toString();
      let headerSize = 8;
      if (atomSize === 1 && header.length >= 16) {
        atomSize = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (atomSize === 0) {
        atomSize = fileSize - position;
      }
      if (atomSize < headerSize || position + atomSize > fileSize) return null;
      if (type === 'moov') {
        if (atomSize > 128 * 1024 * 1024) return null;
        const length = atomSize;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, position);
        const root = quickTimeAtoms(buffer, 0, buffer.length).find(atom => atom.type === 'moov');
        if (!root) return null;
        const all = quickTimeDescendants(buffer, root);
        const result = { recordedAt: null, frameRate: 0, codec: '', width: 0, height: 0 };
        const mvhd = all.find(atom => atom.type === 'mvhd');
        if (mvhd) {
          const version = buffer[mvhd.dataStart];
          const seconds = version === 1
            ? Number(buffer.readBigUInt64BE(mvhd.dataStart + 4))
            : buffer.readUInt32BE(mvhd.dataStart + 4);
          if (seconds) {
            const date = new Date((seconds - QUICKTIME_EPOCH_SECONDS) * 1000);
            if (!Number.isNaN(date.getTime())) result.recordedAt = date;
          }
        }
        for (const trak of all.filter(atom => atom.type === 'trak')) {
          const trackAtoms = quickTimeDescendants(buffer, trak);
          const hdlr = trackAtoms.find(atom => atom.type === 'hdlr');
          if (!hdlr || hdlr.dataStart + 12 > hdlr.end || buffer.subarray(hdlr.dataStart + 8, hdlr.dataStart + 12).toString() !== 'vide') continue;
          const tkhd = trackAtoms.find(atom => atom.type === 'tkhd');
          if (tkhd && tkhd.end - tkhd.dataStart >= 8) {
            result.width = buffer.readUInt32BE(tkhd.end - 8) / 65536;
            result.height = buffer.readUInt32BE(tkhd.end - 4) / 65536;
          }
          const stsd = trackAtoms.find(atom => atom.type === 'stsd');
          if (stsd && stsd.dataStart + 16 <= stsd.end) result.codec = buffer.subarray(stsd.dataStart + 12, stsd.dataStart + 16).toString();
          const stts = trackAtoms.find(atom => atom.type === 'stts');
          if (stts && stts.dataStart + 8 <= stts.end) {
            let samples = 0;
            let ticks = 0;
            const count = buffer.readUInt32BE(stts.dataStart + 4);
            let entryPosition = stts.dataStart + 8;
            for (let index = 0; index < count && entryPosition + 8 <= stts.end; index += 1) {
              const sampleCount = buffer.readUInt32BE(entryPosition);
              const sampleDelta = buffer.readUInt32BE(entryPosition + 4);
              samples += sampleCount;
              ticks += sampleCount * sampleDelta;
              entryPosition += 8;
            }
            const mdhd = trackAtoms.find(atom => atom.type === 'mdhd');
            if (mdhd && ticks > 0) {
              const version = buffer[mdhd.dataStart];
              const timescaleOffset = version === 1 ? mdhd.dataStart + 20 : mdhd.dataStart + 12;
              const timescale = buffer.readUInt32BE(timescaleOffset);
              result.frameRate = timescale > 0 ? samples * timescale / ticks : 0;
            }
          }
          break;
        }
        return result;
      }
      position += atomSize;
    }
    return null;
  } finally {
    await handle.close();
  }
}

async function capturedAt(filePath, fileStats) {
  const ext = extension(filePath);
  if (['mp4', 'mov', 'm4v'].includes(ext)) {
    const metadata = await quickTimeMetadata(filePath, fileStats.size).catch(() => null);
    if (metadata?.recordedAt) return { date: metadata.recordedAt, source: 'video metadata', description: '' };
  }
  if (['jpg', 'jpeg', 'png', 'tif', 'tiff', 'dng'].includes(ext)) {
    const metadata = await embeddedImageMetadata(filePath, fileStats.size).catch(() => null);
    if (metadata?.date) return { date: metadata.date, source: 'embedded EXIF', description: metadata.description };
  }
  const named = dateFromFilename(path.basename(filePath));
  return named
    ? { date: named, source: 'filename', description: '' }
    : { date: fileStats.mtime, source: 'modified-time fallback', description: '' };
}

function mediaType(filePath, description) {
  const version = description.match(/Version: (RAW|EDITED)/i)?.[1]?.toUpperCase();
  if (version) return version;
  const ext = extension(filePath);
  if (VIDEO_EXTENSIONS.has(ext) || ext === 'srt' || ext === 'thm') return 'VIDEO';
  if (RAW_EXTENSIONS.has(ext)) return 'RAW';
  if (AUDIO_EXTENSIONS.has(ext)) return 'AUDIO';
  return 'PHOTO';
}

function isOrganised(relativeParts) {
  return /^\d{4}$/.test(relativeParts[0] ?? '')
    && /^\d{2} - /.test(relativeParts[1] ?? '')
    && /^(?:\d{1,2})(?:st|nd|rd|th)$/.test(relativeParts[2] ?? '');
}

async function walk(directory, relativeParts, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'System Volume Information') continue;
    const fullPath = path.join(directory, entry.name);
    const parts = [...relativeParts, entry.name];
    if (entry.isDirectory()) await walk(fullPath, parts, output);
    else if (entry.isFile()) output.push({ fullPath, relativeParts: parts, organised: isOrganised(relativeParts) });
  }
}

function safeRelative(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path escaped the selected DCIM folder.');
  return relative;
}

async function scanLibrary(selectedRoot) {
  const entries = [];
  await walk(selectedRoot, [], entries);
  const existing = new Set(entries.filter(entry => entry.organised).map(entry => entry.relativeParts.join('/')));
  const actions = [];
  const skipped = [];
  let bytesTotal = 0;

  for (const entry of entries) {
    if (entry.organised) continue;
    const ext = extension(entry.fullPath);
    const relative = entry.relativeParts.join('/');
    const fileStats = await stat(entry.fullPath);
    if (ext === 'lrf') {
      actions.push({ kind: 'trash', source: entry.fullPath, sourcePath: relative, size: fileStats.size });
      continue;
    }
    if (!MEDIA_EXTENSIONS.has(ext)) {
      skipped.push(`${relative} — unrecognised`);
      continue;
    }
    const metadata = await capturedAt(entry.fullPath, fileStats);
    if ((/^vlcsnap-/i.test(path.basename(entry.fullPath)) || /^\d{3}\.(jpe?g|png)$/i.test(path.basename(entry.fullPath))) && metadata.source !== 'embedded EXIF') {
      skipped.push(`${relative} — missing retrofit metadata`);
      continue;
    }
    const folders = folderParts(metadata.date);
    const type = mediaType(entry.fullPath, metadata.description);
    const base = `${captureBasename(metadata.date)}_${type}`;
    let number = 1;
    let targetName = `${base}.${ext}`;
    let targetRelative = path.join(...folders, targetName);
    while (existing.has(targetRelative.split(path.sep).join('/')) || existsSync(path.join(selectedRoot, targetRelative))) {
      number += 1;
      targetName = `${base}-${number}.${ext}`;
      targetRelative = path.join(...folders, targetName);
    }
    existing.add(targetRelative.split(path.sep).join('/'));
    actions.push({
      kind: 'move',
      source: entry.fullPath,
      sourcePath: relative,
      target: path.join(selectedRoot, targetRelative),
      targetPath: targetRelative.split(path.sep).join('/'),
      size: fileStats.size,
      dateSource: metadata.source,
    });
    bytesTotal += fileStats.size;
  }

  return {
    rootName: path.basename(selectedRoot),
    actions,
    skipped,
    moveCount: actions.filter(action => action.kind === 'move').length,
    trashCount: actions.filter(action => action.kind === 'trash').length,
    bytesTotal,
  };
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function moveVerified(action) {
  await mkdir(path.dirname(action.target), { recursive: true });
  const [sourceStats, targetParentStats] = await Promise.all([stat(action.source), stat(path.dirname(action.target))]);
  if (sourceStats.dev === targetParentStats.dev) {
    await rename(action.source, action.target);
    return 'atomic move';
  }
  const partial = `${action.target}.tbs-partial`;
  await copyFile(action.source, partial);
  const copiedStats = await stat(partial);
  if (copiedStats.size !== sourceStats.size) {
    await unlink(partial).catch(() => undefined);
    throw new Error(`Copy size verification failed for ${action.sourcePath}. The original was retained.`);
  }
  const [sourceHash, copiedHash] = await Promise.all([hashFile(action.source), hashFile(partial)]);
  if (sourceHash !== copiedHash) {
    await unlink(partial).catch(() => undefined);
    throw new Error(`SHA-256 verification failed for ${action.sourcePath}. The original was retained.`);
  }
  await rename(partial, action.target);
  await unlink(action.source);
  return 'verified copy';
}

async function trashFile(filePath) {
  if (process.env.TBS_MEDIA_HELPER_TEST_ROOT) {
    const trashDirectory = path.join(process.env.TBS_MEDIA_HELPER_TEST_ROOT, '.Test Trash');
    await mkdir(trashDirectory, { recursive: true });
    await rename(filePath, path.join(trashDirectory, path.basename(filePath)));
    return;
  }
  if (!existsSync(TRASH_TOOL_PATH)) throw new Error('The native Trash helper is missing. Reinstall the media helper.');
  await execFileAsync(TRASH_TOOL_PATH, [filePath], { timeout: 60_000 });
}

function startCaffeinate() {
  if (caffeinateProcess) return;
  caffeinateProcess = spawn('/usr/bin/caffeinate', ['-i', '-m'], { stdio: 'ignore' });
}

function stopCaffeinate() {
  if (!caffeinateProcess) return;
  caffeinateProcess.kill('SIGTERM');
  caffeinateProcess = null;
}

async function runOrganisation() {
  if (!rootPath || !preview || job.running) return;
  stopRequested = false;
  startCaffeinate();
  job = {
    ...idleJob('Organising media'),
    phase: 'organising',
    running: true,
    total: preview.actions.length,
    bytesTotal: preview.bytesTotal,
    startedAt: Date.now(),
  };
  try {
    for (const action of preview.actions) {
      if (stopRequested) {
        job.phase = 'stopped';
        job.message = 'Stopped safely before starting another file. The card is not yet ejected.';
        break;
      }
      job.currentFile = action.sourcePath;
      job.currentFileBytes = action.size;
      if (action.kind === 'trash') await trashFile(action.source);
      else {
        await moveVerified(action);
        job.bytesCompleted += action.size;
      }
      job.completed += 1;
    }
    if (!stopRequested) {
      job.phase = 'complete';
      job.message = 'Organisation complete. Review media before ejecting the card.';
    }
  } catch (error) {
    job.phase = 'error';
    job.error = error instanceof Error ? error.message : String(error);
    job.message = 'Organisation stopped because an error occurred.';
  } finally {
    job.running = false;
    job.stopping = false;
    job.currentFile = '';
    job.currentFileBytes = 0;
    job.finishedAt = Date.now();
    stopCaffeinate();
    preview = await scanLibrary(rootPath).catch(() => preview);
  }
}

async function organisedDays() {
  if (!rootPath) return [];
  const days = [];
  for (const year of await readdir(rootPath, { withFileTypes: true })) {
    if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
    const yearPath = path.join(rootPath, year.name);
    for (const month of await readdir(yearPath, { withFileTypes: true })) {
      if (!month.isDirectory() || !/^\d{2} - /.test(month.name)) continue;
      const monthPath = path.join(yearPath, month.name);
      for (const day of await readdir(monthPath, { withFileTypes: true })) {
        if (!day.isDirectory() || !/^\d{1,2}(?:st|nd|rd|th)$/.test(day.name)) continue;
        const dayPath = path.join(monthPath, day.name);
        const files = (await readdir(dayPath, { withFileTypes: true }))
          .filter(entry => entry.isFile() && VIDEO_EXTENSIONS.has(extension(entry.name)))
          .map(entry => entry.name)
          .sort((a, b) => a.localeCompare(b));
        if (files.length) {
          const key = [year.name, month.name, day.name].join('/');
          days.push({ key, label: `${day.name} ${month.name.replace(/^\d{2} - /, '')} ${year.name}`, videoCount: files.length });
        }
      }
    }
  }
  return days.sort((a, b) => a.key.localeCompare(b.key));
}

function pathForDay(key) {
  if (!rootPath || !/^\d{4}\/\d{2} - [^/]+\/\d{1,2}(?:st|nd|rd|th)$/.test(key)) throw new Error('Invalid day key.');
  const candidate = path.resolve(rootPath, ...key.split('/'));
  safeRelative(rootPath, candidate);
  return candidate;
}

async function videosForDay(key) {
  const dayPath = pathForDay(key);
  const filePaths = [];
  for (const entry of await readdir(dayPath, { withFileTypes: true })) {
    if (!entry.isFile() || !VIDEO_EXTENSIONS.has(extension(entry.name))) continue;
    filePaths.push(path.join(dayPath, entry.name));
  }
  return videoRecords(filePaths);
}

function organisedDayForRelativePath(relativePath) {
  const parts = relativePath.split('/');
  if (parts.length !== 4 || !/^\d{4}$/.test(parts[0]) || !/^\d{2} - /.test(parts[1]) || !/^\d{1,2}(?:st|nd|rd|th)$/.test(parts[2])) return {};
  return {
    dayKey: parts.slice(0, 3).join('/'),
    dayLabel: `${parts[2]} ${parts[1].replace(/^\d{2} - /, '')} ${parts[0]}`,
  };
}

async function videoRecords(filePaths) {
  const files = [];
  for (const filePath of filePaths) files.push(await videoRecord(filePath));
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function videoRecord(filePath) {
  const fileStats = await stat(filePath);
  const name = path.basename(filePath);
  const relativePath = path.relative(rootPath, filePath);
  const recordedAt = dateFromFilename(name) ?? fileStats.mtime;
  const metadata = await quickTimeMetadata(filePath, fileStats.size).catch(() => null);
  return {
    id: Buffer.from(relativePath).toString('base64url'),
    name,
    relativePath,
    size: fileStats.size,
    lastModified: fileStats.mtimeMs,
    captured: existsSync(captureMarkerPath(filePath)),
    ...organisedDayForRelativePath(relativePath),
    recordedAt: recordedAt.toISOString(),
    recordedAtSource: dateFromFilename(name) ? 'filename' : 'file modified date',
    frameRate: metadata?.frameRate ?? 0,
    codec: metadata?.codec ?? '',
    width: metadata?.width ?? 0,
    height: metadata?.height ?? 0,
  };
}

async function allVideos() {
  if (!rootPath) throw new Error('Select a folder first.');
  const filePaths = [];
  const walk = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(entryPath);
      else if (entry.isFile() && VIDEO_EXTENSIONS.has(extension(entry.name))) filePaths.push(entryPath);
    }
  };
  await walk(rootPath);
  return videoRecords(filePaths);
}

function resolveMediaId(id) {
  if (!rootPath || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid media id.');
  const relative = Buffer.from(id, 'base64url').toString('utf8');
  const candidate = path.resolve(rootPath, relative);
  safeRelative(rootPath, candidate);
  return candidate;
}

async function assertVideoFile(filePath) {
  if (!VIDEO_EXTENSIONS.has(extension(filePath)) || !(await stat(filePath)).isFile()) throw new Error('The selected file is not a video.');
}

async function rotateVideoFile(videoPath, degrees, onProgress) {
  if (rotationRunning) throw new Error('Wait for the current video rotation to finish.');
  if (job.running) throw new Error('Wait for media organisation to finish before rotating a video.');
  rotationRunning = true;
  const ext = path.extname(videoPath);
  const partialPath = path.join(
    path.dirname(videoPath),
    `.${path.basename(videoPath, ext)}.tbs-rotate-${randomBytes(8).toString('hex')}${ext}`,
  );
  try {
    onProgress(0.01, 'Preparing lossless rotation…');
    if (process.env.TBS_MEDIA_HELPER_TEST_ROTATE === '1') {
      await copyFile(videoPath, partialPath);
      onProgress(0.85, 'Verifying rotated video…');
    } else {
      await new Promise((resolve, reject) => {
        const child = spawn(ROTATE_TOOL_PATH, [videoPath, partialPath, String(degrees)], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdoutBuffer = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => {
          stdoutBuffer += chunk;
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() ?? '';
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (Number.isFinite(event.progress)) onProgress(Math.min(0.9, Math.max(0.02, event.progress * 0.9)), 'Writing rotated video…');
            } catch {
              // Ignore non-progress diagnostic output from the native exporter.
            }
          }
        });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', code => code === 0
          ? resolve()
          : reject(new Error(stderr.trim() || `The native video exporter exited with code ${code}.`)));
      });
      onProgress(0.92, 'Verifying rotated video…');
    }
    const outputStats = await stat(partialPath);
    if (!outputStats.isFile() || outputStats.size === 0) throw new Error('The rotated video failed verification; the original was retained.');
    onProgress(0.97, 'Replacing the original safely…');
    await rename(partialPath, videoPath);
    onProgress(1, 'Rotation saved.');
    return videoRecord(videoPath);
  } finally {
    rotationRunning = false;
    await unlink(partialPath).catch(() => undefined);
  }
}

function volumeRoot(selectedPath) {
  const resolved = path.resolve(selectedPath);
  const match = resolved.match(/^\/Volumes\/[^/]+/);
  if (!match) throw new Error('The selected folder is not on a mounted external volume.');
  return match[0];
}

function originFor(request) {
  return request.headers.origin || '';
}

function setCors(request, response, origin = originFor(request)) {
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range, X-TBS-Day, X-TBS-Filename');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
}

function json(request, response, status, value) {
  setCors(request, response);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function readBody(request, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    request.on('data', chunk => {
      length += chunk.length;
      if (length > limit) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function authorised(request, url) {
  const origin = originFor(request);
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
  return Boolean(origin && token && config.clients[origin]?.token === token);
}

async function confirmPair(origin) {
  if (!/^https?:\/\/[^/]+$/i.test(origin)) throw new Error('Invalid website origin.');
  const existing = config.clients[origin];
  if (existing?.token) return existing.token;
  if (process.env.TBS_MEDIA_HELPER_TEST_AUTO_PAIR === '1') {
    const token = randomBytes(32).toString('base64url');
    config.clients[origin] = { token, approvedAt: new Date().toISOString() };
    saveConfig();
    return token;
  }
  const script = [
    'on run argv',
    'set websiteOrigin to item 1 of argv',
    'display dialog "Allow " & websiteOrigin & " to control The Break Surf Media Helper on this Mac?" buttons {"Cancel", "Allow"} default button "Allow" with title "The Break Surf Media Helper" with icon caution',
    'return button returned of result',
    'end run',
  ].join('\n');
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script, '--', origin], { timeout: 120_000 });
  if (!stdout.includes('Allow')) throw new Error('Connection was not approved.');
  const token = randomBytes(32).toString('base64url');
  config.clients[origin] = { token, approvedAt: new Date().toISOString() };
  saveConfig();
  return token;
}

async function chooseFolder() {
  if (process.env.TBS_MEDIA_HELPER_TEST_ROOT) {
    await access(process.env.TBS_MEDIA_HELPER_TEST_ROOT);
    return path.resolve(process.env.TBS_MEDIA_HELPER_TEST_ROOT);
  }
  const script = [
    'set selectedFolder to choose folder with prompt "Select the root DCIM folder containing your camera media"',
    'POSIX path of selectedFolder',
  ].join('\n');
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script], { timeout: 300_000 });
  const selected = stdout.trim().replace(/\/$/, '');
  if (!selected) throw new Error('No folder was selected.');
  await access(selected);
  return selected;
}

async function serveMedia(request, response, mediaPath) {
  const fileStats = await stat(mediaPath);
  const range = request.headers.range;
  setCors(request, response);
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Cache-Control', 'private, max-age=3600');
  response.setHeader('Content-Type', extension(mediaPath) === 'mov' ? 'video/quicktime' : 'video/mp4');
  if (!range) {
    response.writeHead(200, { 'Content-Length': fileStats.size });
    createReadStream(mediaPath).pipe(response);
    return;
  }
  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    response.writeHead(416, { 'Content-Range': `bytes */${fileStats.size}` });
    response.end();
    return;
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), fileStats.size - 1) : fileStats.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileStats.size) {
    response.writeHead(416, { 'Content-Range': `bytes */${fileStats.size}` });
    response.end();
    return;
  }
  response.writeHead(206, {
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${fileStats.size}`,
  });
  createReadStream(mediaPath, { start, end }).pipe(response);
}

async function requestHandler(request, response) {
  try {
    const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
    if (request.method === 'OPTIONS') {
      setCors(request, response);
      response.writeHead(204, { 'Access-Control-Max-Age': '600' });
      response.end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      json(request, response, 200, { ok: true, version: VERSION, paired: Boolean(config.clients[originFor(request)]?.token) });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/pair') {
      const origin = originFor(request);
      const token = await confirmPair(origin);
      json(request, response, 200, { token, version: VERSION });
      return;
    }
    if (!authorised(request, url)) {
      json(request, response, 401, { error: 'The admin panel is not paired with this helper.' });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/pick') {
      if (job.running) throw new Error('Wait for the current organisation job to finish.');
      rootPath = await chooseFolder();
      job = idleJob('Scanning the selected folder');
      preview = await scanLibrary(rootPath);
      job = idleJob('Folder connected. Review the proposed changes.');
      json(request, response, 200, publicPreview());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/preview') {
      if (!rootPath || !preview) throw new Error('Select a DCIM folder first.');
      json(request, response, 200, publicPreview());
      return;
    }
    if (request.method === 'POST' && url.pathname === '/organise') {
      if (!rootPath || !preview) throw new Error('Select and scan a DCIM folder first.');
      if (!job.running) void runOrganisation();
      json(request, response, 202, { job });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/job') {
      json(request, response, 200, { job, preview: publicPreview(!job.running), days: job.running ? [] : await organisedDays() });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/stop') {
      if (job.running) {
        stopRequested = true;
        job.stopping = true;
        job.message = 'Stop requested. Finishing the current file safely…';
      }
      json(request, response, 200, { job });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/days') {
      json(request, response, 200, { days: await organisedDays() });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/videos') {
      json(request, response, 200, { videos: await videosForDay(url.searchParams.get('day') || '') });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/videos/all') {
      json(request, response, 200, { videos: await allVideos() });
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/media/')) {
      await serveMedia(request, response, resolveMediaId(url.pathname.slice('/media/'.length)));
      return;
    }
    const rotateMatch = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\/rotate$/);
    if (request.method === 'POST' && rotateMatch) {
      setCors(request, response);
      response.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      });
      const send = value => response.write(`${JSON.stringify(value)}\n`);
      try {
        const videoPath = resolveMediaId(rotateMatch[1]);
        await assertVideoFile(videoPath);
        const body = JSON.parse((await readBody(request, 1024)).toString('utf8'));
        if (body.degrees !== -90 && body.degrees !== 90) throw new Error('Rotation must be -90 or 90 degrees.');
        const video = await rotateVideoFile(videoPath, body.degrees, (progress, message) => send({ progress, message }));
        send({ progress: 1, message: 'Rotation saved.', complete: true, video });
      } catch (error) {
        send({ error: error instanceof Error ? error.message : String(error) });
      }
      response.end();
      return;
    }
    const capturedMatch = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\/captured$/);
    if (request.method === 'POST' && capturedMatch) {
      const videoPath = resolveMediaId(capturedMatch[1]);
      await assertVideoFile(videoPath);
      await writeFile(captureMarkerPath(videoPath), `${JSON.stringify({ capturedAt: new Date().toISOString(), source: path.basename(videoPath) }, null, 2)}\n`);
      json(request, response, 200, { captured: true });
      return;
    }
    const deleteMatch = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)$/);
    if (request.method === 'DELETE' && deleteMatch) {
      const videoPath = resolveMediaId(deleteMatch[1]);
      await assertVideoFile(videoPath);
      await trashFile(videoPath);
      const markerPath = captureMarkerPath(videoPath);
      if (existsSync(markerPath)) await trashFile(markerPath).catch(() => undefined);
      json(request, response, 200, { message: `${path.basename(videoPath)} was moved to Trash.` });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/capture') {
      const day = request.headers['x-tbs-day'];
      const filename = request.headers['x-tbs-filename'];
      if (typeof day !== 'string' || typeof filename !== 'string') throw new Error('Missing capture destination.');
      if (!/^\d{4}-\d{2}-\d{2}_\d{6}-\d{3}_(?:RAW|EDITED)(?:-\d+)?\.jpg$/i.test(filename)) throw new Error('Invalid capture filename.');
      const dayPath = pathForDay(day);
      let candidate = filename;
      let number = 2;
      while (existsSync(path.join(dayPath, candidate))) {
        candidate = filename.replace(/\.jpg$/i, `-${number}.jpg`);
        number += 1;
      }
      const body = await readBody(request, 100 * 1024 * 1024);
      await writeFile(path.join(dayPath, candidate), body, { flag: 'wx' });
      json(request, response, 201, { filename: candidate });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/eject') {
      if (!rootPath) throw new Error('No DCIM folder is connected.');
      if (job.running) throw new Error('Stop safely and wait for the current file before ejecting.');
      if (rotationRunning) throw new Error('Wait for the current video rotation to finish before ejecting.');
      const volume = volumeRoot(rootPath);
      const { stdout } = await execFileAsync('/usr/sbin/diskutil', ['eject', volume], { timeout: 120_000 });
      rootPath = null;
      preview = null;
      job = idleJob('The SD card was ejected safely.');
      json(request, response, 200, { message: stdout.trim() || 'The SD card was ejected safely.' });
      return;
    }
    json(request, response, 404, { error: 'Not found.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    json(request, response, 500, { error: message });
  }
}

function publicPreview(includeActions = true) {
  if (!preview || !rootPath) return null;
  return {
    rootName: preview.rootName,
    moveCount: preview.moveCount,
    trashCount: preview.trashCount,
    bytesTotal: preview.bytesTotal,
    skipped: preview.skipped,
    actions: includeActions
      ? preview.actions.slice(0, 100).map(action => ({
        kind: action.kind,
        sourcePath: action.sourcePath,
        targetPath: action.targetPath,
        size: action.size,
        dateSource: action.dateSource,
      }))
      : [],
    actionCount: preview.actions.length,
  };
}

if (!existsSync(CERT_PATH) || !existsSync(KEY_PATH)) {
  console.error(`Missing HTTPS certificate. Run install.sh first. Expected ${CERT_PATH}`);
  process.exit(1);
}

const server = createServer({
  cert: readFileSync(CERT_PATH),
  key: readFileSync(KEY_PATH),
}, (request, response) => {
  void requestHandler(request, response);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`The Break Surf Media Helper ${VERSION} listening on https://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  stopCaffeinate();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  stopCaffeinate();
  server.close(() => process.exit(0));
});
