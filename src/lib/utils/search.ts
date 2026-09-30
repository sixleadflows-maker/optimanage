// How the search boxes on the list pages decide what matches, so they all
// behave the same way.

/** Lower-case with spaces and punctuation dropped: "Ray-Ban" and "rayban" read the same. */
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * True when every word typed appears somewhere in the record -- in any order
 * and across its fields, so "ray ban aviator" finds brand "Ray-Ban" with name
 * "Aviator", and "0300 111" finds the phone "0300-1110001". A box with nothing
 * (or only spaces) typed matches everything.
 */
export function matchesSearch(query: string, fields: (string | null | undefined)[]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = fields.filter(Boolean).join(" ").toLowerCase();
  const squashed = squash(text);
  return words.every((w) => {
    if (text.includes(w)) return true;
    const bare = squash(w);
    return bare !== "" && squashed.includes(bare);
  });
}
