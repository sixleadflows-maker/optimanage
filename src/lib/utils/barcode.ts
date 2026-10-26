// Barcode scanners. A scanner is a keyboard: it types the code very fast and
// (usually) presses Enter. These helpers tidy what it typed and decide whether
// it's the code a product was saved with.

/** Sent on window when a scan comes in with no box to type into; a page that uses it calls preventDefault(). */
export const SCAN_EVENT = "optimanage:scan";

/**
 * What a scanner sent, tidied: no hidden control characters, no symbology
 * prefix some scanners are set to send ("]C1" in front of a Code 128), and no
 * spaces at either end.
 */
export function cleanScan(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/^\][A-Za-z][0-9A-Za-z]/, "").trim();
}

const DIGITS = /^[0-9]+$/;
const withoutLeadingZeros = (s: string) => s.replace(/^0+/, "") || "0";

/**
 * True when a scanned code is the code a product was saved with: the same
 * apart from letter case, or -- for codes that are all digits -- apart from
 * zeros in front, which some scanners add to or drop from UPC/EAN codes.
 */
export function sameBarcode(saved: string, scanned: string): boolean {
  const a = cleanScan(saved);
  const b = cleanScan(scanned);
  if (!a || !b) return false;
  if (a.toUpperCase() === b.toUpperCase()) return true;
  return DIGITS.test(a) && DIGITS.test(b) && withoutLeadingZeros(a) === withoutLeadingZeros(b);
}

/** Every way a scanned code could have been saved, for looking it up in the database. */
export function barcodeCandidates(scanned: string): string[] {
  const code = cleanScan(scanned);
  if (!code) return [];
  const out = new Set([code, code.toUpperCase(), code.toLowerCase()]);
  if (DIGITS.test(code)) {
    const bare = withoutLeadingZeros(code);
    for (let len = bare.length; len <= Math.max(13, code.length); len++) out.add(bare.padStart(len, "0"));
  }
  return [...out];
}

/**
 * The character a key press stands for in a scan. Digits are read from the
 * key's position, so they come through with Num Lock off (a scanner that types
 * on the number pad) and on any keyboard layout.
 */
export function scanCharacter(e: KeyboardEvent): string {
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  if (digit && (!e.shiftKey || e.code.startsWith("Numpad"))) return digit[1];
  return e.key.length === 1 ? e.key : "";
}
