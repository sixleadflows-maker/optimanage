"use server";

import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

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
