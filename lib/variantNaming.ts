// Every variant/raw-material item code in this codebase ends with its size
// as the last dash-separated segment (e.g. "Staple Tee-Daffodil-L",
// "FoTL-MBL-L") — these helpers lean on that same convention already used
// throughout the PO item picker and Designs grouping.

export function variantSize(itemCode: string): string {
  const parts = itemCode.split('-');
  return parts[parts.length - 1] ?? '';
}

export function variantFamily(itemCode: string): string {
  return itemCode.split('-').slice(0, -1).join('-');
}

export function withVariantSize(itemCode: string, newSize: string): string {
  const parts = itemCode.split('-');
  parts[parts.length - 1] = newSize;
  return parts.join('-');
}
