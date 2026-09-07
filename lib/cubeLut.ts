export type CubeLut = {
  title: string;
  size: number;
  data: Float32Array;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
};

function triple(parts: string[], label: string): [number, number, number] {
  const values = parts.slice(1, 4).map(Number);
  if (values.length !== 3 || values.some(value => !Number.isFinite(value))) {
    throw new Error(`Invalid ${label} in LUT file.`);
  }
  return values as [number, number, number];
}

export function parseCubeLut(source: string, fallbackTitle = 'Custom LUT'): CubeLut {
  let title = fallbackTitle;
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const originalLine of source.split(/\r?\n/)) {
    const line = originalLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
    const keyword = parts[0]?.toUpperCase();
    if (keyword === 'TITLE') {
      title = parts.slice(1).join(' ').replace(/^"|"$/g, '') || fallbackTitle;
    } else if (keyword === 'LUT_3D_SIZE') {
      size = Number(parts[1]);
    } else if (keyword === 'LUT_1D_SIZE') {
      throw new Error('This tool needs a 3D .cube LUT; the selected file is a 1D LUT.');
    } else if (keyword === 'DOMAIN_MIN') {
      domainMin = triple(parts, 'DOMAIN_MIN');
    } else if (keyword === 'DOMAIN_MAX') {
      domainMax = triple(parts, 'DOMAIN_MAX');
    } else if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(parts[0] ?? '')) {
      const colour = parts.slice(0, 3).map(Number);
      if (colour.length !== 3 || colour.some(value => !Number.isFinite(value))) {
        throw new Error('Invalid colour row in LUT file.');
      }
      values.push(...colour);
    }
  }

  if (!Number.isInteger(size) || size < 2 || size > 128) {
    throw new Error('The LUT has a missing or unsupported LUT_3D_SIZE (supported: 2–128).');
  }
  if (values.length !== size ** 3 * 3) {
    throw new Error(`The LUT declares size ${size}, but contains ${values.length / 3} of ${size ** 3} required colour rows.`);
  }
  if (domainMax.some((value, index) => value <= domainMin[index])) {
    throw new Error('The LUT has an invalid input domain.');
  }

  return { title, size, data: new Float32Array(values), domainMin, domainMax };
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function applyCubeLut(image: ImageData, lut: CubeLut, strength: number) {
  const pixels = image.data;
  const amount = clamp(strength);
  if (amount === 0) return image;
  const { data, size, domainMin, domainMax } = lut;
  const scale = size - 1;

  const sample = (red: number, green: number, blue: number, channel: number) => {
    return data[((blue * size + green) * size + red) * 3 + channel];
  };

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const inputRed = pixels[offset] / 255;
    const inputGreen = pixels[offset + 1] / 255;
    const inputBlue = pixels[offset + 2] / 255;
    const red = clamp((inputRed - domainMin[0]) / (domainMax[0] - domainMin[0])) * scale;
    const green = clamp((inputGreen - domainMin[1]) / (domainMax[1] - domainMin[1])) * scale;
    const blue = clamp((inputBlue - domainMin[2]) / (domainMax[2] - domainMin[2])) * scale;
    const r0 = Math.floor(red), g0 = Math.floor(green), b0 = Math.floor(blue);
    const r1 = Math.min(r0 + 1, scale), g1 = Math.min(g0 + 1, scale), b1 = Math.min(b0 + 1, scale);
    const rf = red - r0, gf = green - g0, bf = blue - b0;

    for (let channel = 0; channel < 3; channel += 1) {
      const c00 = sample(r0, g0, b0, channel) * (1 - rf) + sample(r1, g0, b0, channel) * rf;
      const c10 = sample(r0, g1, b0, channel) * (1 - rf) + sample(r1, g1, b0, channel) * rf;
      const c01 = sample(r0, g0, b1, channel) * (1 - rf) + sample(r1, g0, b1, channel) * rf;
      const c11 = sample(r0, g1, b1, channel) * (1 - rf) + sample(r1, g1, b1, channel) * rf;
      const low = c00 * (1 - gf) + c10 * gf;
      const high = c01 * (1 - gf) + c11 * gf;
      const mapped = clamp(low * (1 - bf) + high * bf);
      const original = channel === 0 ? inputRed : channel === 1 ? inputGreen : inputBlue;
      pixels[offset + channel] = Math.round((original * (1 - amount) + mapped * amount) * 255);
    }
  }
  return image;
}
