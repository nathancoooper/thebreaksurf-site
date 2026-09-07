export type SnapshotExif = {
  description?: string;
  make?: string;
  model?: string;
  lens?: string;
  software?: string;
  capturedAt: Date;
  sourceFile?: string;
  offsetSeconds?: number;
};

type IfdEntry = { tag: number; value: Uint8Array };

const encoder = new TextEncoder();

function ascii(value: string) {
  const bytes = encoder.encode(value);
  const output = new Uint8Array(bytes.length + 1);
  output.set(bytes);
  return output;
}

function pad(value: number, size = 2) {
  return String(value).padStart(size, '0');
}

function exifDate(date: Date) {
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function offsetString(date: Date) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  return `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function writeIfd(view: DataView, offset: number, entries: IfdEntry[], dataStart: number) {
  view.setUint16(offset, entries.length, true);
  let dataOffset = dataStart;
  entries.forEach((entry, index) => {
    const entryOffset = offset + 2 + index * 12;
    view.setUint16(entryOffset, entry.tag, true);
    view.setUint16(entryOffset + 2, entry.tag === 0x8769 ? 4 : 2, true); // LONG or ASCII
    view.setUint32(entryOffset + 4, entry.tag === 0x8769 ? 1 : entry.value.length, true);
    if (entry.value.length <= 4) {
      new Uint8Array(view.buffer, entryOffset + 8, 4).fill(0);
      new Uint8Array(view.buffer, entryOffset + 8, entry.value.length).set(entry.value);
    } else {
      view.setUint32(entryOffset + 8, dataOffset, true);
      new Uint8Array(view.buffer, dataOffset, entry.value.length).set(entry.value);
      dataOffset += entry.value.length;
    }
  });
  view.setUint32(offset + 2 + entries.length * 12, 0, true);
  return dataOffset;
}

export function addExifToJpeg(jpeg: Uint8Array, metadata: SnapshotExif) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Snapshot was not encoded as JPEG.');

  const timestamp = exifDate(metadata.capturedAt);
  const offset = offsetString(metadata.capturedAt);
  const description = [
    metadata.description,
    metadata.sourceFile ? `Source: ${metadata.sourceFile}` : '',
    Number.isFinite(metadata.offsetSeconds) ? `Video offset: ${metadata.offsetSeconds!.toFixed(3)}s` : '',
  ].filter(Boolean).join(' | ');

  const exifEntries: IfdEntry[] = [
    { tag: 0x9003, value: ascii(timestamp) }, // DateTimeOriginal
    { tag: 0x9004, value: ascii(timestamp) }, // DateTimeDigitized
    { tag: 0x9010, value: ascii(offset) },
    { tag: 0x9011, value: ascii(offset) },
    { tag: 0x9012, value: ascii(offset) },
    { tag: 0x9291, value: ascii(pad(metadata.capturedAt.getMilliseconds(), 3)) },
    ...(metadata.lens ? [{ tag: 0xa434, value: ascii(metadata.lens) }] : []),
  ].sort((a, b) => a.tag - b.tag);

  const ifd0Entries: IfdEntry[] = [
    ...(description ? [{ tag: 0x010e, value: ascii(description) }] : []),
    ...(metadata.make ? [{ tag: 0x010f, value: ascii(metadata.make) }] : []),
    ...(metadata.model ? [{ tag: 0x0110, value: ascii(metadata.model) }] : []),
    ...(metadata.software ? [{ tag: 0x0131, value: ascii(metadata.software) }] : []),
    { tag: 0x0132, value: ascii(timestamp) },
    { tag: 0x8769, value: uint32(0) },
  ].sort((a, b) => a.tag - b.tag);

  const ifd0Offset = 8;
  const ifd0TableEnd = ifd0Offset + 2 + ifd0Entries.length * 12 + 4;
  const exifIfdOffset = ifd0TableEnd + ifd0Entries.filter(entry => entry.value.length > 4).reduce((sum, entry) => sum + entry.value.length, 0);
  const exifTableEnd = exifIfdOffset + 2 + exifEntries.length * 12 + 4;
  const totalSize = exifTableEnd + exifEntries.filter(entry => entry.value.length > 4).reduce((sum, entry) => sum + entry.value.length, 0);
  const tiff = new Uint8Array(totalSize);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00], 0);
  view.setUint32(4, ifd0Offset, true);

  const pointer = ifd0Entries.find(entry => entry.tag === 0x8769)!;
  pointer.value = uint32(exifIfdOffset);
  writeIfd(view, ifd0Offset, ifd0Entries, ifd0TableEnd);
  writeIfd(view, exifIfdOffset, exifEntries, exifTableEnd);

  const signature = encoder.encode('Exif\0\0');
  const payloadLength = signature.length + tiff.length;
  if (payloadLength + 2 > 0xffff) throw new Error('Metadata is too large for a JPEG EXIF segment.');
  const app1 = new Uint8Array(payloadLength + 4);
  app1.set([0xff, 0xe1, (payloadLength + 2) >> 8, (payloadLength + 2) & 0xff], 0);
  app1.set(signature, 4);
  app1.set(tiff, 4 + signature.length);

  const output = new Uint8Array(jpeg.length + app1.length);
  output.set(jpeg.slice(0, 2), 0);
  output.set(app1, 2);
  output.set(jpeg.slice(2), 2 + app1.length);
  return output;
}
