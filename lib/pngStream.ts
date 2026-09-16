// Minimal streaming PNG writer.
//
// A 57cm sheet at 300 DPI is 6,732px wide, and a 4.65m one would be 54,921px
// tall — far past what a browser canvas can allocate, so the sheet cannot be
// rasterised in one piece. Instead the caller renders it in horizontal bands
// and feeds the rows in here; this compresses as it goes and emits a single
// PNG (and a single Blob), so the printer still receives one file per sheet.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const body = out.subarray(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(body));
  return out;
}

export class PngStream {
  private readonly chunks: Uint8Array[] = [];
  private readonly writer: WritableStreamDefaultWriter<BufferSource>;
  private readonly finished: Promise<void>;
  private closed = false;

  constructor(
    private readonly width: number,
    private readonly height: number,
    /** 11811 = 300 DPI, 1181 = 30 DPI. Written into a pHYs chunk. */
    pixelsPerMetre = 11811,
  ) {
    this.chunks.push(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // colour type 6 = RGBA (transparency matters for DTF)
    ihdr[10] = 0;  // deflate
    ihdr[11] = 0;  // adaptive filtering
    ihdr[12] = 0;  // no interlacing
    this.chunks.push(chunk('IHDR', ihdr));

    // pHYs: how big a pixel is, so a RIP that reads it sees 300 DPI.
    const phys = new Uint8Array(9);
    new DataView(phys.buffer).setUint32(0, pixelsPerMetre);
    new DataView(phys.buffer).setUint32(4, pixelsPerMetre);
    phys[8] = 1; // unit = metre
    this.chunks.push(chunk('pHYs', phys));

    const compress = new CompressionStream('deflate');
    this.writer = compress.writable.getWriter();
    const reader = compress.readable.getReader();
    this.finished = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        // Keep IDAT chunks to a sane size; PNG allows the stream to be split.
        for (let offset = 0; offset < value.length; offset += 1 << 22) {
          this.chunks.push(chunk('IDAT', value.subarray(offset, offset + (1 << 22))));
        }
      }
    })();
  }

  /**
   * Appends one band of RGBA rows. `rgba` must be width * rows * 4 bytes.
   * Rows are filtered with "Up" (each byte minus the one above it), which
   * costs nothing to compute and compresses flat artwork and empty sheet area
   * far better than writing raw bytes.
   */
  async addBand(rgba: Uint8Array, rows: number, previousRow: Uint8Array | null): Promise<Uint8Array> {
    const stride = this.width * 4;
    const out = new Uint8Array((stride + 1) * rows);
    let o = 0;
    for (let y = 0; y < rows; y++) {
      const src = y * stride;
      out[o++] = 2; // filter type: Up
      const above = y > 0 ? rgba.subarray(src - stride, src) : previousRow;
      if (above) {
        for (let x = 0; x < stride; x++) out[o + x] = rgba[src + x] - above[x];
      } else {
        out.set(rgba.subarray(src, src + stride), o);
      }
      o += stride;
    }
    await this.writer.write(out);
    return rgba.subarray((rows - 1) * stride, rows * stride);
  }

  async finish(): Promise<Blob> {
    if (!this.closed) {
      this.closed = true;
      await this.writer.close();
      await this.finished;
      this.chunks.push(chunk('IEND', new Uint8Array(0)));
    }
    return new Blob(this.chunks as BlobPart[], { type: 'image/png' });
  }
}
