/**
 * A phone number reduced to what identifies it, so "0300-111 0001",
 * "03001110001" and "+92 300 1110001" all count as the same number.
 * Empty when there's too little to be a number.
 */
export function phoneKey(phone: string | null | undefined): string {
  let digits = (phone ?? "").replace(/[^0-9]/g, "");
  if (digits.startsWith("0092")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("92") && digits.length >= 12) digits = `0${digits.slice(2)}`;
  return digits.length >= 7 ? digits : "";
}

/**
 * A number the way WhatsApp links want it: country code first, digits only.
 * "0300-1234567" and "+92 300 1234567" both give "923001234567"; "" when there's no number.
 */
export function waNumber(phone: string | null | undefined): string {
  const key = phoneKey(phone);
  return key.startsWith("0") ? `92${key.slice(1)}` : key;
}

/** True when both are real numbers and they're the same one. */
export function samePhone(a: string | null | undefined, b: string | null | undefined) {
  const key = phoneKey(a);
  return key !== "" && key === phoneKey(b);
}

/** Names compared the way people read them: case and extra spaces ignored. */
export function sameName(a: string, b: string) {
  const tidy = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return tidy(a) !== "" && tidy(a) === tidy(b);
}

/** A customer's numbers: the main one, then the second if they have one. */
export function numbersOf(c: { phone?: string | null; phone2?: string | null }): string[] {
  return [c.phone, c.phone2].filter((n): n is string => !!n && n.trim() !== "");
}

/** True when any number of one customer is any number of the other. */
export function shareNumber(
  a: { phone?: string | null; phone2?: string | null },
  b: { phone?: string | null; phone2?: string | null },
) {
  return numbersOf(a).some((x) => numbersOf(b).some((y) => samePhone(x, y)));
}

/** "0300 1110001 / 0321 5550000": both numbers, for a screen or a printed bill. */
export function allNumbers(c: { phone?: string | null; phone2?: string | null }, separator = " / ") {
  return numbersOf(c).join(separator);
}
