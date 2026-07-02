"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const brandTagValue = { Original: "ORIGINAL", Copy: "COPY", Unbranded: "UNBRANDED" } as const;

export interface ProductInput {
  name: string;
  brand: string;
  model: string;
  category: string;
  type: string;
  colour: string;
  size: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  barcode: string;
  lowStockThreshold: number;
  image: string;
  brandTag: "Original" | "Copy" | "Unbranded";
  priceThreshold: number;
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function createProduct(input: ProductInput) {
  await requireAuth();
  const product = await db.product.create({
    data: {
      name: input.name,
      brand: input.brand,
      model: input.model,
      category: input.category,
      type: input.type,
      colour: input.colour,
      size: input.size,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      stock: input.stock,
      barcode: input.barcode,
      lowStockThreshold: input.lowStockThreshold,
      image: input.image,
      brandTag: brandTagValue[input.brandTag],
      priceThreshold: input.priceThreshold,
    },
  });
  revalidatePath("/dashboard/inventory");
  return { ok: true, id: product.id };
}

export async function updateProduct(id: string, input: ProductInput) {
  await requireAuth();
  await db.product.update({
    where: { id },
    data: {
      name: input.name,
      brand: input.brand,
      model: input.model,
      category: input.category,
      type: input.type,
      colour: input.colour,
      size: input.size,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      stock: input.stock,
      barcode: input.barcode,
      lowStockThreshold: input.lowStockThreshold,
      image: input.image,
      brandTag: brandTagValue[input.brandTag],
      priceThreshold: input.priceThreshold,
    },
  });
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/inventory/${id}`);
  return { ok: true };
}

export async function deleteProduct(id: string) {
  await requireAuth();
  // Soft delete to preserve sale history references
  await db.product.update({ where: { id }, data: { active: false } });
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}
