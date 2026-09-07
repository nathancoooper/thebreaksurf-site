const HELPER_ORIGIN = 'https://localhost:47831';
const TOKEN_KEY = 'tbs-media-helper-token';
export const MIN_MEDIA_HELPER_VERSION = '1.2.0';

export type HelperAction = {
  kind: 'move' | 'trash';
  sourcePath: string;
  targetPath?: string;
  size: number;
  dateSource?: string;
};

export type HelperPreview = {
  rootName: string;
  moveCount: number;
  trashCount: number;
  bytesTotal: number;
  skipped: string[];
  actions: HelperAction[];
  actionCount: number;
};

export type HelperJob = {
  phase: 'idle' | 'organising' | 'stopped' | 'complete' | 'error';
  message: string;
  running: boolean;
  stopping: boolean;
  completed: number;
  total: number;
  bytesCompleted: number;
  bytesTotal: number;
  currentFile: string;
  currentFileBytes: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string;
};

export type HelperDay = {
  key: string;
  label: string;
  videoCount: number;
};

export type HelperVideo = {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  lastModified: number;
  captured: boolean;
  dayKey?: string;
  dayLabel?: string;
  recordedAt: string;
  recordedAtSource: 'filename' | 'file modified date';
  frameRate: number;
  codec: string;
  width: number;
  height: number;
};

function storedToken() {
  return typeof window === 'undefined' ? '' : localStorage.getItem(TOKEN_KEY) ?? '';
}

async function helperFetch<T>(path: string, options: RequestInit = {}, requireToken = true): Promise<T> {
  const headers = new Headers(options.headers);
  const token = storedToken();
  if (requireToken && token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${HELPER_ORIGIN}${path}`, { ...options, headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `The media helper returned ${response.status}.`);
  return data;
}

export async function detectMediaHelper() {
  try {
    return await helperFetch<{ ok: boolean; version: string; paired: boolean }>('/health', {}, false);
  } catch {
    return null;
  }
}

export function mediaHelperSupports(version: string, minimum = MIN_MEDIA_HELPER_VERSION) {
  const parts = (value: string) => value.split('.').map(part => Number(part) || 0);
  const current = parts(version);
  const required = parts(minimum);
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    if ((current[index] ?? 0) !== (required[index] ?? 0)) return (current[index] ?? 0) > (required[index] ?? 0);
  }
  return true;
}

export async function pairMediaHelper(force = false) {
  if (!force && storedToken()) return storedToken();
  const paired = await helperFetch<{ token: string }>('/pair', { method: 'POST' }, false);
  localStorage.setItem(TOKEN_KEY, paired.token);
  return paired.token;
}

export async function selectHelperFolder() {
  return helperFetch<HelperPreview>('/pick', { method: 'POST' });
}

export async function startHelperOrganisation() {
  return helperFetch<{ job: HelperJob }>('/organise', { method: 'POST' });
}

export async function getHelperJob() {
  return helperFetch<{ job: HelperJob; preview: HelperPreview | null; days: HelperDay[] }>('/job');
}

export async function stopHelperOrganisation() {
  return helperFetch<{ job: HelperJob }>('/stop', { method: 'POST' });
}

export async function getHelperDays() {
  return helperFetch<{ days: HelperDay[] }>('/days');
}

export async function getHelperVideos(day: string) {
  return helperFetch<{ videos: HelperVideo[] }>(`/videos?day=${encodeURIComponent(day)}`);
}

export async function getAllHelperVideos() {
  return helperFetch<{ videos: HelperVideo[] }>('/videos/all');
}

export function helperMediaUrl(id: string, version?: number) {
  return `${HELPER_ORIGIN}/media/${encodeURIComponent(id)}?token=${encodeURIComponent(storedToken())}${version ? `&v=${encodeURIComponent(version)}` : ''}`;
}

export async function saveHelperCapture(day: string, filename: string, blob: Blob) {
  return helperFetch<{ filename: string }>('/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg',
      'X-TBS-Day': day,
      'X-TBS-Filename': filename,
    },
    body: blob,
  });
}

export async function markHelperVideoCaptured(id: string) {
  return helperFetch<{ captured: boolean }>(`/video/${encodeURIComponent(id)}/captured`, { method: 'POST' });
}

export async function deleteHelperVideo(id: string) {
  return helperFetch<{ message: string }>(`/video/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function rotateHelperVideo(
  id: string,
  degrees: -90 | 90,
  onProgress: (progress: number, message: string) => void,
): Promise<HelperVideo> {
  const response = await fetch(`${HELPER_ORIGIN}/video/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${storedToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ degrees }),
    cache: 'no-store',
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || `The media helper returned ${response.status}.`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rotated: HelperVideo | null = null;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as { progress?: number; message?: string; complete?: boolean; video?: HelperVideo; error?: string };
    if (event.error) throw new Error(event.error);
    if (typeof event.progress === 'number') onProgress(event.progress, event.message || 'Rotating video…');
    if (event.complete && event.video) rotated = event.video;
  };
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(consume);
    if (done) break;
  }
  consume(buffer);
  if (!rotated) throw new Error('The helper did not return the rotated video.');
  return rotated as HelperVideo;
}

export async function ejectHelperVolume() {
  return helperFetch<{ message: string }>('/eject', { method: 'POST' });
}
