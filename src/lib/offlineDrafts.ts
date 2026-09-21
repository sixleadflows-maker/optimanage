import type { CreateSaleInput } from "@/lib/actions/sales";

const STORAGE_KEY = "optimanage_offline_sale_drafts";

/**
 * A bill made while the till couldn't reach the server. It was printed and
 * handed over with a temporary number (offlineRef); it syncs by itself once
 * the connection is back. input.clientRef makes that sync safe to repeat —
 * a retry finds the invoice the first attempt created instead of adding
 * another — and input.date keeps the time it was really rung up, so it lands
 * on the right day in Cash Collection.
 */
export interface OfflineDraft {
  id: string;
  draftedAt: string;
  input: CreateSaleInput;
  offlineRef?: string;
  summary: {
    customerName: string;
    itemCount: number;
    total: number;
  };
  // The server was reached but refused the bill; needs someone to look at it.
  lastError?: string;
  // Bumped each time the bill is corrected at the till before it has synced.
  // A sync already on its way with an older version must not drop the newer
  // one, and has to apply the correction to the invoice it just created.
  revision?: number;
}

function readAll(): OfflineDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: OfflineDraft[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Storage full or blocked -- nothing more can be done from here.
  }
}

export function getDrafts(): OfflineDraft[] {
  return readAll();
}

export function addDraft(input: CreateSaleInput, summary: OfflineDraft["summary"]): OfflineDraft {
  const draft: OfflineDraft = {
    id: input.clientRef ?? crypto.randomUUID(),
    draftedAt: new Date().toISOString(),
    input,
    offlineRef: input.offlineRef,
    summary,
  };
  const drafts = readAll().filter((d) => d.id !== draft.id);
  drafts.push(draft);
  writeAll(drafts);
  return draft;
}

/**
 * Saves a correction over a bill still waiting to sync. False if it's no
 * longer waiting (it has gone through, so the invoice itself must be changed).
 */
export function replaceDraft(id: string, input: CreateSaleInput, summary: OfflineDraft["summary"]): boolean {
  const drafts = readAll();
  const draft = drafts.find((d) => d.id === id);
  if (!draft) return false;
  writeAll(drafts.map((d) => (d.id === id
    ? { ...d, input: { ...input, offlineRef: d.input.offlineRef, date: d.input.date }, summary, lastError: undefined, revision: (d.revision ?? 0) + 1 }
    : d)));
  return true;
}

/** Drops a synced bill -- unless it was corrected while that sync was under way. */
export function removeDraft(id: string, revision?: number) {
  writeAll(readAll().filter((d) => d.id !== id || (revision !== undefined && (d.revision ?? 0) !== revision)));
}

export function markDraftFailed(id: string, error: string) {
  writeAll(readAll().map((d) => (d.id === id ? { ...d, lastError: error } : d)));
}

// No 0/O or 1/I, so a number read back over the phone can't be misheard.
const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** The temporary number printed on a bill made offline, e.g. OFF-0919-7K2Q. */
export function makeOfflineRef(at: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const random = crypto.getRandomValues(new Uint32Array(4));
  const code = Array.from(random, (n) => REF_ALPHABET[n % REF_ALPHABET.length]).join("");
  return `OFF-${pad(at.getMonth() + 1)}${pad(at.getDate())}-${code}`;
}
