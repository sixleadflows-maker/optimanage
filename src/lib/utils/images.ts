// Product.image supports multiple photos as a comma-separated string of URLs,
// so a product gallery works without a schema change.
export function parseImages(field: string | undefined | null): string[] {
  if (!field) return [];
  return field.split(",").map((s) => s.trim()).filter(Boolean);
}

export function firstImage(field: string | undefined | null): string | undefined {
  return parseImages(field)[0];
}
