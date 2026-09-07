export interface PriceTier { minMeters: number; pricePerMeter: number; label?: string }

// The DTF supplier's fixed roll width and per-metre bulk-discount tiers —
// price drops as you buy more length, in whole-metre increments. Stored in
// cm as the base unit — 0.57 * 100 in floating point isn't exactly 57.
export const DTF_ROLL_WIDTH_CM = 57;
export const DTF_ROLL_WIDTH_M = DTF_ROLL_WIDTH_CM / 100;

export const DTF_PRICE_TIERS: PriceTier[] = [
  { minMeters: 1, pricePerMeter: 15.00 },
  { minMeters: 2, pricePerMeter: 14.00 },
  { minMeters: 5, pricePerMeter: 12.00, label: 'Popular' },
  { minMeters: 10, pricePerMeter: 10.00, label: 'Best value' },
  { minMeters: 20, pricePerMeter: 8.50 },
];

export function tierForMeters(meters: number): PriceTier {
  let chosen = DTF_PRICE_TIERS[0];
  for (const tier of DTF_PRICE_TIERS) {
    if (meters >= tier.minMeters) chosen = tier;
  }
  return chosen;
}
