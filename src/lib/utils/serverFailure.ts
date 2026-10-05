// The server failing in a way nobody planned for (as opposed to a problem staff
// can act on, which is returned as a message). A bad request or a bug comes back
// as a message the screen can show -- otherwise the Save button just spins, or
// the till takes it for a lost connection and keeps the bill on the computer
// where it can never go through. A dropped or timed-out database connection is
// still thrown: that one really is worth retrying, and the till does so by itself.
export function unexpectedFailure(action: string, e: unknown) {
  const err = e as { name?: string; code?: string; message?: string } | null;
  const text = `${err?.code ?? ""} ${err?.message ?? ""}`;
  if (/P1001|P1002|P1008|P1017|P2024|P2028|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|terminating connection|timed out/i.test(text)) throw e;
  console.error(`[${action}] unexpected failure`, e);
  const tag = [err?.name, err?.code].filter(Boolean).join(" ");
  return {
    ok: false as const,
    error: `Something went wrong saving this, and nothing was changed. Try again; if it keeps happening, tell the developer${tag ? ` (${tag})` : ""}.`,
  };
}
