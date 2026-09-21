// Eye-test figures. Lens powers (SPH, CYL, ADD) are always written with their
// sign -- "+2.50", "-1.25" -- as opticians do: a plus left off reads as a
// minus someone forgot. Axis and PD are plain numbers.

export type RxField = "Sph" | "Cyl" | "Axis" | "Pd" | "Add";

export const isPowerField = (field: RxField) => field === "Sph" || field === "Cyl" || field === "Add";

/** A power as an optician writes it: "+2.50", "-1.25", "0.00". */
export function formatRxPower(n: number): string {
  if (!n) return "0.00";
  return `${n > 0 ? "+" : "-"}${Math.abs(n).toFixed(2)}`;
}

/** Any prescription figure, for showing in a table. */
export function formatRxValue(field: RxField, n: number): string {
  return isPowerField(field) ? formatRxPower(n) : String(n);
}

/** What a form field starts from when filled from a saved prescription. */
export function rxFieldText(field: RxField, n: number): string {
  if (!n) return "";
  return formatRxValue(field, n);
}

/** Reads a form field back. Blank, or a sign with no number yet, is 0. */
export function parseRxText(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}
