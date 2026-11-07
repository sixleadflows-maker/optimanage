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

/**
 * The reading (near) power: the distance SPH with the ADD put on it, as "+0.50".
 * "" when there's no ADD, or when the ADD was written in words and can't be added.
 */
export function readingSph(sph: number, add: number, addText = ""): string {
  if (addText.trim() || !add) return "";
  return formatRxPower(Math.round((sph + add) * 100) / 100);
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

// The reading power typed into its own boxes, as written ("+1.50", "90"). A
// box left empty shows what SPH + ADD works out to instead.
export const RX_READING_FIELDS = [
  "rightReadSph", "rightReadCyl", "rightReadAxis", "leftReadSph", "leftReadCyl", "leftReadAxis",
] as const;
export type RxReadingField = (typeof RX_READING_FIELDS)[number];

// Everything kept as written rather than as a number: the words for a power,
// and the reading typed in.
export const RX_TEXT_FIELDS = [
  "rightSphText", "rightCylText", "rightAddText", "leftSphText", "leftCylText", "leftAddText",
  ...RX_READING_FIELDS,
] as const;
export type RxTextColumns = Record<(typeof RX_TEXT_FIELDS)[number], string>;

/** The words for each power and the typed-in reading, cleaned up the one way before they're stored. */
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

/** A reading box as stored: the power written out ("+1.50") or its words; an axis as a whole number. */
function readingText(v: string, axis = false): string {
  if (isRxTextValue(v)) return rxTextOf(v);
  if (!/\d/.test(v)) return "";
  const n = parseRxText(v);
  return axis ? String(Math.round(n)) : formatRxPower(n);
}

/** What a reading box starts from when filled from a saved prescription. */
export function readingFieldText(stored: string): string {
  const v = stored.trim();
  return !v || /^[+-]?(\d+\.?\d*|\.\d+)$/.test(v) ? v : `${RX_TEXT_MARK}${v}`;
}

/**
 * One eye's reading powers as shown -- D. Sph, D. Cyl, Axis. A box that was
 * typed in shows what was typed; one left empty shows the distance SPH with the
 * ADD put on, and the CYL and axis as they are. "" where there's neither.
 */
export function readingPowers(eye: {
  sph: number; cyl: number; axis: number; add: number; cylText?: string; addText?: string;
  readSph?: string; readCyl?: string; readAxis?: string;
}): [string, string, string] {
  const sph = readingSph(eye.sph, eye.add, eye.addText);
  const cyl = sph && (eye.cyl || eye.cylText?.trim()) ? formatRxPower(eye.cyl, eye.cylText) : "";
  const axis = sph && eye.axis ? String(eye.axis) : "";
  return [eye.readSph?.trim() || sph, eye.readCyl?.trim() || cyl, eye.readAxis?.trim() || axis];
}

/** The words typed into a prescription form's power boxes, and the reading typed into its own. */
export function rxFormTexts(f: {
  rightSph: string; rightCyl: string; rightAdd: string; leftSph: string; leftCyl: string; leftAdd: string;
} & Record<RxReadingField, string>): RxTextColumns {
  return {
    rightSphText: rxTextOf(f.rightSph), rightCylText: rxTextOf(f.rightCyl), rightAddText: rxTextOf(f.rightAdd),
    leftSphText: rxTextOf(f.leftSph), leftCylText: rxTextOf(f.leftCyl), leftAddText: rxTextOf(f.leftAdd),
    rightReadSph: readingText(f.rightReadSph), rightReadCyl: readingText(f.rightReadCyl), rightReadAxis: readingText(f.rightReadAxis, true),
    leftReadSph: readingText(f.leftReadSph), leftReadCyl: readingText(f.leftReadCyl), leftReadAxis: readingText(f.leftReadAxis, true),
  };
}

/**
 * Prescriptions in the order a history reads: the latest visit first, and the
 * prescriptions from one visit -- distance and reading on one slip, or a
 * family's -- together, in the order they were typed in. Several saved with
 * one bill share the same moment, so sorting by date alone left them in any
 * order, reading before distance one day and after it the next.
 */
export function rxHistoryOrder<T extends { id: string; customerId: string; saleId: string | null; date: Date; createdAt: Date }>(rows: T[]): T[] {
  const visit = (r: T) => r.saleId ? `sale:${r.saleId}` : `${r.customerId}:${r.date.toISOString().slice(0, 10)}`;
  const latest = new Map<string, number>();
  for (const r of rows) latest.set(visit(r), Math.max(latest.get(visit(r)) ?? 0, r.date.getTime()));
  return [...rows].sort((a, b) => {
    const va = visit(a);
    const vb = visit(b);
    if (va !== vb) return latest.get(vb)! - latest.get(va)! || va.localeCompare(vb);
    return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  });
}

/** A reading typed into its own boxes, on one line: "READING +1.50 / -0.50 × 90" ("" when none was typed). */
export function readingLine(readSph = "", readCyl = "", readAxis = ""): string {
  const [sph, cyl, axis] = [readSph.trim(), readCyl.trim(), readAxis.trim()];
  if (!sph && !cyl && !axis) return "";
  return `READING ${[sph || "0.00", cyl ? `/ ${cyl}` : "", axis ? `× ${axis}` : ""].filter(Boolean).join(" ")}`;
}

/**
 * A prescription on one line, as on a lab slip: "R -2.00 / -0.50 × 180 ADD +2.50 · L -2.25 / -0.75 × 170".
 * A reading typed into its own boxes follows its eye: "READING +1.50 / -0.50 × 90".
 */
export function rxSummary(p: {
  rightSph: number; rightCyl: number; rightAxis: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftAdd: number;
} & Partial<RxTextColumns>): string {
  const eye = (sph: number, cyl: number, axis: number, add: number, sphText = "", cylText = "", addText = "", readSph = "", readCyl = "", readAxis = "") =>
    [
      formatRxPower(sph, sphText),
      cyl || cylText.trim() ? `/ ${formatRxPower(cyl, cylText)}` : "",
      axis ? `× ${axis}` : "",
      add || addText.trim() ? `ADD ${formatRxPower(add, addText)}` : "",
      readingLine(readSph, readCyl, readAxis),
    ].filter(Boolean).join(" ");
  return `R ${eye(p.rightSph, p.rightCyl, p.rightAxis, p.rightAdd, p.rightSphText, p.rightCylText, p.rightAddText, p.rightReadSph, p.rightReadCyl, p.rightReadAxis)} · L ${eye(p.leftSph, p.leftCyl, p.leftAxis, p.leftAdd, p.leftSphText, p.leftCylText, p.leftAddText, p.leftReadSph, p.leftReadCyl, p.leftReadAxis)}`;
}
