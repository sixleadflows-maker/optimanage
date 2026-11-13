// Safe to import into the browser: no database here.

/** A line for a toast when a change reached days that were already closed. */
export const closesCorrectedNote = (count: number) =>
  count > 1 ? `${count} closed days were updated to match.` : count === 1 ? "The closed day was updated to match." : "";
