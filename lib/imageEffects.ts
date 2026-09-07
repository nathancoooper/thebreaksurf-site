// Applies luminance-preserving monochromatic Gaussian-style noise. A small,
// seeded PRNG keeps the hot loop fast enough for full-resolution 4K captures;
// summing six uniform samples approximates a normal distribution.
export function applyMonochromaticGaussianNoise(image: ImageData, amount: number, seed = Date.now()) {
  const pixels = image.data;
  const strength = Math.min(1, Math.max(0, amount));
  if (strength === 0) return image;

  let state = (seed >>> 0) || 0x6d2b79f5;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
  const standardDeviation = strength * 127.5;
  const normalise = 1 / Math.sqrt(0.5); // variance of six U(0,1) samples

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const gaussian = (random() + random() + random() + random() + random() + random() - 3) * normalise;
    const delta = gaussian * standardDeviation;
    pixels[offset] = pixels[offset] + delta;
    pixels[offset + 1] = pixels[offset + 1] + delta;
    pixels[offset + 2] = pixels[offset + 2] + delta;
  }
  return image;
}
