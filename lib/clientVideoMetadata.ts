export type VideoFileMetadata = {
  recordedAt: Date;
  recordedAtSource: 'video metadata' | 'file modified date' | 'filename';
  make: string;
  model: string;
  lens: string;
  software: string;
  frameRate: number;
  codec: string;
  width: number;
  height: number;
  raw: Record<string, string>;
};

type Atom = { type: string; start: number; dataStart: number; end: number };

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'ilst']);
const QUICKTIME_EPOCH_SECONDS = 2_082_844_800;

function typeAt(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1),
    view.getUint8(offset + 2), view.getUint8(offset + 3),
  );
}

function atoms(view: DataView, start: number, end: number): Atom[] {
  const found: Atom[] = [];
  let position = start;
  while (position + 8 <= end) {
    let size = view.getUint32(position);
    const type = typeAt(view, position + 4);
    let header = 8;
    if (size === 1 && position + 16 <= end) {
      const large = view.getBigUint64(position + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(large);
      header = 16;
    } else if (size === 0) {
      size = end - position;
    }
    if (size < header || position + size > end) break;
    found.push({ type, start: position, dataStart: position + header, end: position + size });
    position += size;
  }
  return found;
}

function descendants(view: DataView, parent: Atom): Atom[] {
  const output: Atom[] = [];
  const walk = (start: number, end: number) => {
    for (const atom of atoms(view, start, end)) {
      output.push(atom);
      if (CONTAINERS.has(atom.type)) walk(atom.dataStart, atom.end);
      if (atom.type === 'meta') walk(atom.dataStart + 4, atom.end); // full-box header
    }
  };
  walk(parent.dataStart, parent.end);
  return output;
}

async function findTopLevelAtom(file: File, wanted: string) {
  let position = 0;
  while (position + 8 <= file.size) {
    const header = new DataView(await file.slice(position, Math.min(position + 16, file.size)).arrayBuffer());
    if (header.byteLength < 8) return null;
    let size = header.getUint32(0);
    const type = typeAt(header, 4);
    let headerSize = 8;
    if (size === 1) {
      if (header.byteLength < 16) return null;
      const large = header.getBigUint64(8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(large);
      headerSize = 16;
    } else if (size === 0) {
      size = file.size - position;
    }
    if (size < headerSize || position + size > file.size) return null;
    if (type === wanted) return { start: position, size };
    position += size;
  }
  return null;
}

function cleanString(bytes: Uint8Array) {
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return decoded.replace(/^\0+|\0+$/g, '').trim();
}

function atomText(view: DataView, atom: Atom) {
  const children = atoms(view, atom.dataStart, atom.end);
  const data = children.find(child => child.type === 'data');
  const start = data ? Math.min(data.dataStart + 8, data.end) : atom.dataStart;
  return cleanString(new Uint8Array(view.buffer, view.byteOffset + start, Math.max(0, (data?.end ?? atom.end) - start)));
}

function quickTimeDate(seconds: number) {
  if (!seconds) return null;
  const date = new Date((seconds - QUICKTIME_EPOCH_SECONDS) * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMdta(view: DataView, all: Atom[], raw: Record<string, string>) {
  const keysAtom = all.find(atom => atom.type === 'keys');
  const ilst = all.find(atom => atom.type === 'ilst');
  if (!keysAtom || !ilst || keysAtom.dataStart + 8 > keysAtom.end) return;

  const keys: string[] = [];
  let position = keysAtom.dataStart + 8; // version/flags + entry count
  const count = view.getUint32(keysAtom.dataStart + 4);
  for (let index = 0; index < count && position + 8 <= keysAtom.end; index += 1) {
    const size = view.getUint32(position);
    if (size < 8 || position + size > keysAtom.end) break;
    keys.push(cleanString(new Uint8Array(view.buffer, view.byteOffset + position + 8, size - 8)));
    position += size;
  }

  for (const item of atoms(view, ilst.dataStart, ilst.end)) {
    const index = item.type.split('').reduce((value, character) => (value << 8) + character.charCodeAt(0), 0);
    const key = keys[index - 1];
    const value = atomText(view, item);
    if (key && value) raw[key] = value;
  }
}

function firstValue(raw: Record<string, string>, patterns: RegExp[]) {
  const entry = Object.entries(raw).find(([key, value]) => value && patterns.some(pattern => pattern.test(key)));
  return entry?.[1] ?? '';
}

export async function readVideoMetadata(file: File): Promise<VideoFileMetadata> {
  const fallback = new Date(file.lastModified || Date.now());
  const result: VideoFileMetadata = {
    recordedAt: fallback,
    recordedAtSource: 'file modified date',
    make: '', model: '', lens: '', software: '', frameRate: 0, codec: '', width: 0, height: 0, raw: {},
  };

  const location = await findTopLevelAtom(file, 'moov');
  if (!location || location.size > 128 * 1024 * 1024) return result;
  const buffer = await file.slice(location.start, location.start + location.size).arrayBuffer();
  const view = new DataView(buffer);
  const root = atoms(view, 0, view.byteLength).find(atom => atom.type === 'moov');
  if (!root) return result;
  const all = descendants(view, root);

  const mvhd = all.find(atom => atom.type === 'mvhd');
  if (mvhd) {
    const version = view.getUint8(mvhd.dataStart);
    const seconds = version === 1
      ? Number(view.getBigUint64(mvhd.dataStart + 4))
      : view.getUint32(mvhd.dataStart + 4);
    const date = quickTimeDate(seconds);
    if (date) {
      result.recordedAt = date;
      result.recordedAtSource = 'video metadata';
    }
  }

  const directTags: Record<string, string> = {
    '\u00a9mak': 'make', '\u00a9mod': 'model', '\u00a9swr': 'software',
    '\u00a9day': 'creationDate', '\u00a9xyz': 'location',
  };
  for (const atom of all) {
    const key = directTags[atom.type];
    if (!key) continue;
    const value = atomText(view, atom);
    if (value) result.raw[key] = value;
  }
  parseMdta(view, all, result.raw);

  result.make = firstValue(result.raw, [/(^|\.)make$/i, /manufacturer/i]);
  result.model = firstValue(result.raw, [/(^|\.)model$/i, /camera.*model/i]);
  result.lens = firstValue(result.raw, [/lens.*model/i, /(^|\.)lens$/i]);
  result.software = firstValue(result.raw, [/software/i, /encoder/i]);

  const metadataDate = firstValue(result.raw, [/creationdate/i, /^creationDate$/i, /date$/i]);
  if (metadataDate) {
    const parsed = new Date(metadataDate);
    if (!Number.isNaN(parsed.getTime())) {
      result.recordedAt = parsed;
      result.recordedAtSource = 'video metadata';
    }
  }

  // Locate the video track and calculate its average frame rate from its timing table.
  for (const trak of all.filter(atom => atom.type === 'trak')) {
    const trackAtoms = descendants(view, trak);
    const hdlr = trackAtoms.find(atom => atom.type === 'hdlr');
    if (!hdlr || hdlr.dataStart + 12 > hdlr.end || typeAt(view, hdlr.dataStart + 8) !== 'vide') continue;

    const tkhd = trackAtoms.find(atom => atom.type === 'tkhd');
    if (tkhd && tkhd.end - tkhd.dataStart >= 8) {
      result.width = view.getUint32(tkhd.end - 8) / 65536;
      result.height = view.getUint32(tkhd.end - 4) / 65536;
    }
    const stsd = trackAtoms.find(atom => atom.type === 'stsd');
    if (stsd && stsd.dataStart + 16 <= stsd.end) result.codec = typeAt(view, stsd.dataStart + 12);

    const stts = trackAtoms.find(atom => atom.type === 'stts');
    if (stts && stts.dataStart + 8 <= stts.end) {
      let samples = 0;
      let ticks = 0;
      const count = view.getUint32(stts.dataStart + 4);
      let position = stts.dataStart + 8;
      for (let index = 0; index < count && position + 8 <= stts.end; index += 1) {
        const sampleCount = view.getUint32(position);
        const sampleDelta = view.getUint32(position + 4);
        samples += sampleCount;
        ticks += sampleCount * sampleDelta;
        position += 8;
      }
      const mdhd = trackAtoms.find(atom => atom.type === 'mdhd');
      if (mdhd && ticks > 0) {
        const version = view.getUint8(mdhd.dataStart);
        const timescaleOffset = version === 1 ? mdhd.dataStart + 20 : mdhd.dataStart + 12;
        const timescale = view.getUint32(timescaleOffset);
        result.frameRate = timescale > 0 ? samples * timescale / ticks : 0;
      }
    }
    break;
  }

  return result;
}
