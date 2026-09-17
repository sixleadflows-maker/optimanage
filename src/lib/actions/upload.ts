"use server";

import { put, list } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseImages } from "@/lib/utils/images";

const MAX_SIZE = 5 * 1024 * 1024;

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

// Returned, not thrown: production replaces a thrown message with a generic
// one, so "Image must be under 5MB" would reach staff as "something went wrong".
export async function uploadProductImage(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No photo was selected" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That file isn't an image" };
  if (file.size > MAX_SIZE) return { ok: false, error: "Photo must be under 5MB" };

  try {
    const blob = await put(`products/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return { ok: true, url: blob.url };
  } catch {
    return { ok: false, error: "Couldn't reach the photo store — check the connection and try again" };
  }
}

export interface LibraryImage {
  url: string;
  uploadedAt: string;
  // Products already showing this photo, e.g. "Ray-Ban Aviator RB3025".
  usedBy: string[];
}

/**
 * Every product photo already in the system, so the same picture can be
 * attached to another product (say, another colour of the same frame) without
 * uploading it again. Combines everything ever uploaded with any photo link
 * already on a product.
 */
export async function listImageLibrary(): Promise<{ images: LibraryImage[]; storeUnavailable: boolean }> {
  const session = await auth();
  if (!session?.user) return { images: [], storeUnavailable: false };

  const usedBy = new Map<string, string[]>();
  const withPhotos = await db.product.findMany({
    where: { active: true, NOT: { image: "" } },
    select: { brand: true, name: true, model: true, image: true },
  });
  for (const p of withPhotos) {
    const label = [p.brand, p.name, p.model].filter(Boolean).join(" ");
    for (const url of parseImages(p.image)) usedBy.set(url, [...(usedBy.get(url) ?? []), label]);
  }

  const images = new Map<string, LibraryImage>();
  let storeUnavailable = false;
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "products/", limit: 1000, cursor });
      for (const b of page.blobs) {
        images.set(b.url, { url: b.url, uploadedAt: new Date(b.uploadedAt).toISOString(), usedBy: usedBy.get(b.url) ?? [] });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor && images.size < 5000);
  } catch {
    // Still offer the photos already on products even if the store can't be listed.
    storeUnavailable = true;
  }

  for (const [url, labels] of usedBy) {
    if (!images.has(url)) images.set(url, { url, uploadedAt: "", usedBy: labels });
  }

  return {
    images: [...images.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    storeUnavailable,
  };
}
