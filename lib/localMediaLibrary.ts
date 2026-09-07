import { readVideoMetadata } from '@/lib/clientVideoMetadata';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MEDIA_EXTENSIONS = new Set(['3gp', 'aac', 'arw', 'avi', 'cr2', 'cr3', 'dng', 'gif', 'heic', 'heif', 'insv', 'jpeg', 'jpg', 'm2ts', 'm4a', 'm4v', 'mkv', 'mov', 'mp3', 'mp4', 'mts', 'nef', 'ogg', 'orf', 'png', 'raf', 'raw', 'rw2', 'srt', 'thm', 'tif', 'tiff', 'wav', 'webm', 'webp']);
const VIDEO_EXTENSIONS = new Set(['3gp', 'avi', 'insv', 'm2ts', 'm4v', 'mkv', 'mov', 'mp4', 'mts', 'webm']);
const RAW_EXTENSIONS = new Set(['arw', 'cr2', 'cr3', 'dng', 'nef', 'orf', 'raf', 'raw', 'rw2']);
const AUDIO_EXTENSIONS = new Set(['aac', 'm4a', 'mp3', 'ogg', 'wav']);

type DirectoryWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | DirectoryWithEntries]>;
};

function entriesOf(directory: FileSystemDirectoryHandle) {
  return (directory as DirectoryWithEntries).entries();
}

type DirectoryEntry = {
  file?: File;
  fileHandle?: FileSystemFileHandle;
  parent: FileSystemDirectoryHandle;
  name: string;
  relativeParts: string[];
  organised: boolean;
};

export type OrganisationAction = {
  kind: 'move' | 'delete';
  sourceName: string;
  sourcePath: string;
  sourceParent: FileSystemDirectoryHandle;
  sourceHandle: FileSystemFileHandle;
  file: File;
  targetFolders?: string[];
  targetName?: string;
  dateSource?: string;
};

export type OrganisationPreview = {
  actions: OrganisationAction[];
  skipped: string[];
  moveCount: number;
  deleteCount: number;
};

export type OrganisedDay = {
  key: string;
  label: string;
  handle: FileSystemDirectoryHandle;
  videos: FileSystemFileHandle[];
};

export type LocalLibraryVideo = {
  file: File;
  handle: FileSystemFileHandle;
  parent: FileSystemDirectoryHandle;
  relativePath: string;
  captured: boolean;
};

function extension(name: string) {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

function captureMarkerName(videoName: string) {
  return `.${videoName}.tbs-frame-captures.json`;
}

async function hasCaptureMarker(parent: FileSystemDirectoryHandle, videoName: string) {
  try {
    await parent.getFileHandle(captureMarkerName(videoName));
    return true;
  } catch {
    return false;
  }
}

export async function loadVideosFromDirectory(root: FileSystemDirectoryHandle, recursive = true) {
  const videos: LocalLibraryVideo[] = [];
  const walk = async (directory: FileSystemDirectoryHandle, parts: string[]) => {
    for await (const [name, handle] of entriesOf(directory)) {
      if (name.startsWith('.')) continue;
      if (handle.kind === 'directory') {
        if (recursive) await walk(handle, [...parts, name]);
        continue;
      }
      if (!VIDEO_EXTENSIONS.has(extension(name))) continue;
      const file = await handle.getFile();
      videos.push({
        file,
        handle,
        parent: directory,
        relativePath: [...parts, name].join('/'),
        captured: await hasCaptureMarker(directory, name),
      });
    }
  };
  await walk(root, []);
  return videos.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function markVideoCaptured(parent: FileSystemDirectoryHandle, videoName: string) {
  const handle = await parent.getFileHandle(captureMarkerName(videoName), { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify({ capturedAt: new Date().toISOString(), source: videoName }, null, 2));
  await writable.close();
}

export async function deleteVideoFromDirectory(parent: FileSystemDirectoryHandle, videoName: string) {
  await parent.removeEntry(videoName);
  await parent.removeEntry(captureMarkerName(videoName)).catch(() => undefined);
}

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
}

function folderParts(date: Date) {
  const month = date.getMonth() + 1;
  return [String(date.getFullYear()), `${String(month).padStart(2, '0')} - ${MONTHS[month - 1]}`, ordinal(date.getDate())];
}

function captureBasename(date: Date) {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function validLocalDate(values: number[]) {
  const [year, month, day, hour, minute, second, millisecond = 0] = values;
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function dateFromFilename(name: string) {
  const separated = name.match(/((?:19|20)\d{2})-([01]\d)-([0-3]\d)[_T -]([0-2]\d)([0-5]\d)([0-5]\d)(?:[-_.](\d{3}))?/);
  if (separated) return validLocalDate(separated.slice(1).map(Number));
  const compact = name.match(/((?:19|20)\d{2})([01]\d)([0-3]\d)([0-2]\d)([0-5]\d)([0-5]\d)/);
  if (!compact) return null;
  const values = compact.slice(1).map(Number);
  return /^DJI[_-]/i.test(name)
    ? new Date(Date.UTC(values[0], values[1] - 1, values[2], values[3], values[4], values[5]))
    : validLocalDate(values);
}

function parseTiff(bytes: Uint8Array) {
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!little && !big) return null;
  const uint16 = (offset: number) => view.getUint16(offset, little);
  const uint32 = (offset: number) => view.getUint32(offset, little);
  const values = new Map<number, string>();
  const decoder = new TextDecoder();
  const readIfd = (offset: number) => {
    if (offset < 0 || offset + 2 > bytes.length) return;
    const count = uint16(offset);
    for (let index = 0; index < count; index += 1) {
      const position = offset + 2 + index * 12;
      if (position + 12 > bytes.length) break;
      const tag = uint16(position);
      const type = uint16(position + 2);
      const countValue = uint32(position + 4);
      const dataOffset = countValue <= 4 ? position + 8 : uint32(position + 8);
      if (type === 2 && dataOffset + countValue <= bytes.length) {
        values.set(tag, decoder.decode(bytes.subarray(dataOffset, dataOffset + Math.max(0, countValue - 1))));
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

async function embeddedImageMetadata(file: File) {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let position = 2;
    while (position + 4 <= bytes.length && bytes[position] === 0xff) {
      const marker = bytes[position + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = (bytes[position + 2] << 8) | bytes[position + 3];
      if (marker === 0xe1 && new TextDecoder().decode(bytes.subarray(position + 4, position + 10)) === 'Exif\0\0') return parseTiff(bytes.subarray(position + 10, position + 2 + length));
      position += 2 + length;
    }
  }
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (png) {
    let position = 8;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    while (position + 12 <= bytes.length) {
      const length = view.getUint32(position);
      const type = new TextDecoder().decode(bytes.subarray(position + 4, position + 8));
      if (type === 'eXIf') return parseTiff(bytes.subarray(position + 8, position + 8 + length));
      position += length + 12;
    }
  }
  if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d)) return parseTiff(bytes);
  return null;
}

async function capturedAt(file: File) {
  const ext = extension(file.name);
  if (['mp4', 'mov', 'm4v'].includes(ext)) {
    try {
      const metadata = await readVideoMetadata(file);
      if (metadata.recordedAtSource === 'video metadata') return { date: metadata.recordedAt, source: 'video metadata', description: '' };
    } catch { /* use fallbacks below */ }
  }
  if (['jpg', 'jpeg', 'png', 'tif', 'tiff', 'dng'].includes(ext)) {
    const metadata = await embeddedImageMetadata(file);
    if (metadata?.date) return { date: metadata.date, source: 'embedded EXIF', description: metadata.description };
  }
  const named = dateFromFilename(file.name);
  return named
    ? { date: named, source: 'filename', description: '' }
    : { date: new Date(file.lastModified), source: 'modified-time fallback', description: '' };
}

function mediaType(file: File, description: string) {
  const version = description.match(/Version: (RAW|EDITED)/i)?.[1]?.toUpperCase();
  if (version) return version;
  const ext = extension(file.name);
  if (VIDEO_EXTENSIONS.has(ext) || ext === 'srt' || ext === 'thm') return 'VIDEO';
  if (RAW_EXTENSIONS.has(ext)) return 'RAW';
  if (AUDIO_EXTENSIONS.has(ext)) return 'AUDIO';
  return 'PHOTO';
}

async function scan(directory: FileSystemDirectoryHandle, parts: string[], output: DirectoryEntry[], existing: Set<string>) {
  for await (const [name, handle] of entriesOf(directory)) {
    if (name.startsWith('.')) continue;
    const nextParts = [...parts, name];
    if (handle.kind === 'directory') {
      await scan(handle, nextParts, output, existing);
      continue;
    }
    const organised = /^\d{4}$/.test(parts[0] ?? '') && /^\d{2} - /.test(parts[1] ?? '') && /^(?:\d{1,2})(?:st|nd|rd|th)$/.test(parts[2] ?? '');
    if (organised) existing.add(nextParts.join('/'));
    output.push({ parent: directory, name, relativeParts: nextParts, organised, fileHandle: handle });
  }
}

export async function previewOrganisation(root: FileSystemDirectoryHandle): Promise<OrganisationPreview> {
  const entries: DirectoryEntry[] = [];
  const existing = new Set<string>();
  await scan(root, [], entries, existing);
  const actions: OrganisationAction[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    if (entry.organised || !entry.fileHandle) continue;
    const file = await entry.fileHandle.getFile();
    const ext = extension(entry.name);
    const sourcePath = entry.relativeParts.join('/');
    if (ext === 'lrf') {
      actions.push({ kind: 'delete', sourceName: entry.name, sourcePath, sourceParent: entry.parent, sourceHandle: entry.fileHandle, file });
      continue;
    }
    if (!MEDIA_EXTENSIONS.has(ext)) { skipped.push(`${sourcePath} — unrecognised`); continue; }
    const metadata = await capturedAt(file);
    if ((/^vlcsnap-/i.test(entry.name) || /^\d{3}\.(jpe?g|png)$/i.test(entry.name)) && metadata.source !== 'embedded EXIF') {
      skipped.push(`${sourcePath} — missing retrofit metadata`);
      continue;
    }
    const folders = folderParts(metadata.date);
    const type = mediaType(file, metadata.description);
    const base = `${captureBasename(metadata.date)}_${type}`;
    let number = 1;
    let targetName = `${base}.${ext}`;
    let targetPath = [...folders, targetName].join('/');
    while (existing.has(targetPath)) {
      number += 1;
      targetName = `${base}-${number}.${ext}`;
      targetPath = [...folders, targetName].join('/');
    }
    existing.add(targetPath);
    actions.push({ kind: 'move', sourceName: entry.name, sourcePath, sourceParent: entry.parent, sourceHandle: entry.fileHandle, file, targetFolders: folders, targetName, dateSource: metadata.source });
  }

  return {
    actions,
    skipped,
    moveCount: actions.filter(action => action.kind === 'move').length,
    deleteCount: actions.filter(action => action.kind === 'delete').length,
  };
}

async function directoryAt(root: FileSystemDirectoryHandle, folders: string[]) {
  let directory = root;
  for (const folder of folders) directory = await directory.getDirectoryHandle(folder, { create: true });
  return directory;
}

export async function applyOrganisation(
  root: FileSystemDirectoryHandle,
  preview: OrganisationPreview,
  progress: (completed: number, total: number, label: string, bytesCompleted: number, bytesTotal: number) => void,
  shouldStop: () => boolean = () => false,
) {
  const total = preview.actions.length;
  const bytesTotal = preview.actions.reduce((sum, action) => sum + (action.kind === 'move' ? action.file.size : 0), 0);
  let bytesCompleted = 0;
  for (let index = 0; index < preview.actions.length; index += 1) {
    if (shouldStop()) {
      progress(index, total, 'Stopped safely', bytesCompleted, bytesTotal);
      return { stopped: true };
    }
    const action = preview.actions[index];
    progress(index, total, action.sourcePath, bytesCompleted, bytesTotal);
    if (action.kind === 'delete') {
      await action.sourceParent.removeEntry(action.sourceName);
      continue;
    }
    const targetDirectory = await directoryAt(root, action.targetFolders!);
    const targetHandle = await targetDirectory.getFileHandle(action.targetName!, { create: true });
    const writable = await targetHandle.createWritable();
    try {
      await writable.write(action.file);
      await writable.close();
    } catch (error) {
      await writable.abort();
      await targetDirectory.removeEntry(action.targetName!).catch(() => undefined);
      throw error;
    }
    const copied = await targetHandle.getFile();
    if (copied.size !== action.file.size) {
      await targetDirectory.removeEntry(action.targetName!);
      throw new Error(`Copy verification failed for ${action.sourcePath}; the original was retained.`);
    }
    await action.sourceParent.removeEntry(action.sourceName);
    bytesCompleted += action.file.size;
  }
  progress(total, total, 'Complete', bytesCompleted, bytesTotal);
  return { stopped: false };
}

export async function loadOrganisedDays(root: FileSystemDirectoryHandle) {
  const days: OrganisedDay[] = [];
  for await (const [yearName, yearHandle] of entriesOf(root)) {
    if (yearHandle.kind !== 'directory' || !/^\d{4}$/.test(yearName)) continue;
    for await (const [monthName, monthHandle] of entriesOf(yearHandle)) {
      if (monthHandle.kind !== 'directory' || !/^\d{2} - /.test(monthName)) continue;
      for await (const [dayName, dayHandle] of entriesOf(monthHandle)) {
        if (dayHandle.kind !== 'directory') continue;
        const videos: FileSystemFileHandle[] = [];
        for await (const [name, handle] of entriesOf(dayHandle)) {
          if (handle.kind === 'file' && VIDEO_EXTENSIONS.has(extension(name))) videos.push(handle);
        }
        if (videos.length) days.push({ key: `${yearName}/${monthName}/${dayName}`, label: `${dayName} ${monthName.replace(/^\d{2} - /, '')} ${yearName}`, handle: dayHandle, videos: videos.sort((a, b) => a.name.localeCompare(b.name)) });
      }
    }
  }
  return days.sort((a, b) => a.key.localeCompare(b.key));
}

export async function writeBlobToDirectory(directory: FileSystemDirectoryHandle, filename: string, blob: Blob) {
  let candidate = filename;
  const parsed = filename.match(/^(.*?)(\.[^.]+)$/);
  for (let number = 1; ; number += 1) {
    try {
      await directory.getFileHandle(candidate);
      candidate = `${parsed?.[1] ?? filename}-${number + 1}${parsed?.[2] ?? ''}`;
    } catch { break; }
  }
  const handle = await directory.getFileHandle(candidate, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return candidate;
}
