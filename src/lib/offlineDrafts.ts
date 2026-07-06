import type { CreateSaleInput } from "@/lib/actions/sales";

const STORAGE_KEY = "optimanage_offline_sale_drafts";

export interface OfflineDraft {
  id: string;
  draftedAt: string;
  input: CreateSaleInput;
  summary: {
    customerName: string;
    itemCount: number;
    total: number;
  };
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function getDrafts(): OfflineDraft[] {
  return readAll();
}

export function addDraft(input: CreateSaleInput, summary: OfflineDraft["summary"]): OfflineDraft {
  const draft: OfflineDraft = {
    id: crypto.randomUUID(),
    draftedAt: new Date().toISOString(),
    input,
    summary,
  };
  const drafts = readAll();
  drafts.push(draft);
  writeAll(drafts);
  return draft;
}

export function removeDraft(id: string) {
  writeAll(readAll().filter((d) => d.id !== id));
}
