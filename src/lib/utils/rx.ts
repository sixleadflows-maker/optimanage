// Eye-test figures. Lens powers (SPH, CYL, ADD) are always written with their
// sign -- "+2.50", "-1.25" -- as opticians do: a plus left off reads as a
// minus someone forgot. Axis and PD are plain numbers.
//
// A power can also be written as words when that's what the slip says --
// "Plano", "BAL". The number is then 0 and the words are what's shown.

export type RxField = "Sph" | "Cyl" | "Axis" | "Pd" | "Add";

export const isPowerField = (field: RxField) => field === "Sph" || field === "Cyl" || field === "Add";

// In a form field, words carry this mark in front so the box knows it's in
// text mode -- even while it's still empty.
export const RX_TEXT_MARK = "~";
export const RX_TEXT_MAX = 20;

export const isRxTextValue = (v: string) => v.startsWith(RX_TEXT_MARK);

/** The words in a form field, or "" when it holds a number. */
export function rxTextOf(v: string): string {
  return isRxTextValue(v) ? v.slice(RX_TEXT_MARK.length).trim().slice(0, RX_TEXT_MAX) : "";
}

/** A power as an optician writes it: "+2.50", "-1.25", "0.00" -- or its words. */
export function formatRxPower(n: number, text = ""): string {
  if (text.trim()) return text.trim();
  if (!n) return "0.00";
  return `${n > 0 ? "+" : "-"}${Math.abs(n).toFixed(2)}`;
}

/** Any prescription figure, for showing in a table. */
export function formatRxValue(field: RxField, n: number, text = ""): string {
  return isPowerField(field) ? formatRxPower(n, text) : String(n);
}

/** One eye's figure for a table -- its words, if it was written that way. */
export function formatEyeValue(
  field: RxField,
  eye: { sph: number; cyl: number; axis: number; pd: number; add: number; sphText?: string; cylText?: string; addText?: string },
): string {
  switch (field) {
    case "Sph": return formatRxPower(eye.sph, eye.sphText);
    case "Cyl": return formatRxPower(eye.cyl, eye.cylText);
    case "Add": return formatRxPower(eye.add, eye.addText);
    case "Axis": return String(eye.axis);
    case "Pd": return String(eye.pd);
  }
}

/** What a form field starts from when filled from a saved prescription. */
export function rxFieldText(field: RxField, n: number, text = ""): string {
  if (isPowerField(field) && text.trim()) return `${RX_TEXT_MARK}${text.trim()}`;
  if (!n) return "";
  return formatRxValue(field, n);
}

/** The number a piece of writing starts with: "+2.50 DS" is 2.5, "Plano" has none. */
const LEADING_NUMBER = /^\s*[+-]?(\d+\.?\d*|\.\d+)/;

/**
 * Reads a form field back. Blank, or a sign with no number yet, is 0. Letters
 * written after a number ("+2.50 DS") keep the number; words alone are 0.
 */
export function parseRxText(v: string): number {
  if (isRxTextValue(v)) {
    const lead = v.slice(RX_TEXT_MARK.length).match(LEADING_NUMBER);
    const n = lead ? Number(lead[0]) : 0;
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

export const RX_TEXT_FIELDS = [
  "rightSphText", "rightCylText", "rightAddText", "leftSphText", "leftCylText", "leftAddText",
] as const;
export type RxTextColumns = Record<(typeof RX_TEXT_FIELDS)[number], string>;

/** The words for each power, cleaned up the one way before they're stored. */
export function rxTextColumns(p: Partial<RxTextColumns>): RxTextColumns {
  const out = {} as RxTextColumns;
  for (const k of RX_TEXT_FIELDS) out[k] = (p[k] ?? "").trim().slice(0, RX_TEXT_MAX);
  return out;
}

/** The lens made up for a prescription: what it is, its colour, and any notes. */
export interface RxLensFields {
  lensName?: string;
  lensColor?: string;
  lensDescription?: string;
}

/**
 * The lens columns to store. Only what was given comes back, so a form that
 * knows nothing about the lens (the Prescriptions page) never blanks it.
 */
export function rxLensColumns(p: RxLensFields) {
  const tidy = (v: string) => v.trim().slice(0, 120);
  return {
    ...(p.lensName !== undefined ? { lensName: tidy(p.lensName) } : {}),
    ...(p.lensColor !== undefined ? { lensColor: tidy(p.lensColor) } : {}),
    ...(p.lensDescription !== undefined ? { lensDescription: tidy(p.lensDescription) } : {}),
  };
}

/** How a prescription's lens reads in a history: "Essilor Crizal · Blue Cut · anti-glare". */
export function rxLensLabel(p: { lensName: string; lensColor: string; lensDescription: string }) {
  return [p.lensName, p.lensColor, p.lensDescription].map((s) => s.trim()).filter(Boolean).join(" · ");
}

/** The words typed into a prescription form's power boxes. */
export function rxFormTexts(f: {
  rightSph: string; rightCyl: string; rightAdd: string; leftSph: string; leftCyl: string; leftAdd: string;
}): RxTextColumns {
  return {
    rightSphText: rxTextOf(f.rightSph), rightCylText: rxTextOf(f.rightCyl), rightAddText: rxTextOf(f.rightAdd),
    leftSphText: rxTextOf(f.leftSph), leftCylText: rxTextOf(f.leftCyl), leftAddText: rxTextOf(f.leftAdd),
  };
}
