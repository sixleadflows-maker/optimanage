"use server";

import { put, list } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseImages } from "@/lib/utils/images";

const MAX_SIZE = 5 * 1024 * 1024;

export async function uploadProductImage(formData: FormData): Promise<{ url: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > MAX_SIZE) throw new Error("Image must be under 5MB");

  const blob = await put(`products/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return { url: blob.url };
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
