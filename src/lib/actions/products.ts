"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const brandTagValue = { Original: "ORIGINAL", Copy: "COPY", Branded: "BRANDED", Unbranded: "UNBRANDED" } as const;

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
  brandTag: "Original" | "Copy" | "Branded" | "Unbranded";
  priceThreshold: number;
  isDamaged: boolean;
  damageType: string;
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

// Eyewear frames/sunglasses don't come with a pre-printed retail barcode the
// way packaged goods do, so in-house codes use the "20" prefix -- the same
// range real retailers use for scale/internal-use barcodes -- which keeps
// generated codes from ever colliding with a real manufacturer EAN-13/UPC.
const INTERNAL_BARCODE_PREFIX = "20";

async function nextBarcodeValue(): Promise<string> {
  const existing = await db.product.findMany({
    where: { barcode: { startsWith: INTERNAL_BARCODE_PREFIX } },
    select: { barcode: true },
  });
  let max = 0;
  for (const p of existing) {
    const n = parseInt(p.barcode.slice(INTERNAL_BARCODE_PREFIX.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return INTERNAL_BARCODE_PREFIX + String(max + 1).padStart(6, "0");
}

// Two products count as "the same physical item" when brand + name + model +
// colour + size all match (case-insensitively) -- that's what identifies a
// specific frame SKU. Damaged items are deliberately excluded: they're priced
// per their condition, so they must stay as their own row, never auto-merged.
async function findDuplicateProduct(input: ProductInput) {
  if (input.isDamaged) return null;
  const eq = (value: string) => ({ equals: value.trim(), mode: "insensitive" as const });
  return db.product.findFirst({
    where: {
      active: true,
      isDamaged: false,
      brand: eq(input.brand),
      name: eq(input.name),
      model: eq(input.model),
      colour: eq(input.colour),
      size: eq(input.size),
    },
  });
}

export async function createProduct(input: ProductInput) {
  await requireAuth();

  // If this item already exists (e.g. another box of the same frame turns up),
  // top up its stock instead of creating a duplicate catalogue entry.
  const duplicate = await findDuplicateProduct(input);
  if (duplicate) {
    const addedStock = Math.max(1, input.stock);
    const updated = await db.product.update({
      where: { id: duplicate.id },
      data: { stock: { increment: addedStock } },
    });
    revalidatePath("/dashboard/inventory");
    return { ok: true, id: updated.id, merged: true, addedStock };
  }

  const barcode = input.barcode.trim() || (await nextBarcodeValue());
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
      barcode,
      lowStockThreshold: input.lowStockThreshold,
      image: input.image,
      brandTag: brandTagValue[input.brandTag],
      priceThreshold: input.priceThreshold,
      isDamaged: input.isDamaged,
      damageType: input.isDamaged ? input.damageType : "",
    },
  });
  revalidatePath("/dashboard/inventory");
  return { ok: true, id: product.id, merged: false, addedStock: 0 };
}

// Assigns an internal barcode to every active product that doesn't have one
// yet (e.g. the existing catalog, before this feature existed). Safe to run
// repeatedly -- products that already have a barcode (real or generated)
// are left untouched.
export async function backfillBarcodes(): Promise<{ updated: number }> {
  await requireAuth();
  const missing = await db.product.findMany({
    where: { active: true, barcode: "" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  let next = 0;
  for (const p of missing) {
    if (next === 0) next = parseInt((await nextBarcodeValue()).slice(INTERNAL_BARCODE_PREFIX.length), 10);
    await db.product.update({ where: { id: p.id }, data: { barcode: INTERNAL_BARCODE_PREFIX + String(next).padStart(6, "0") } });
    next++;
  }
  if (missing.length > 0) revalidatePath("/dashboard/inventory");
  return { updated: missing.length };
}

// Returns the next available internal barcode without saving it -- powers the
// "Auto-generate" button on the product form, so the field can be filled on
// demand. The same value only becomes permanent once the product is saved.
export async function generateBarcode(): Promise<{ barcode: string }> {
  await requireAuth();
  return { barcode: await nextBarcodeValue() };
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
      isDamaged: input.isDamaged,
      damageType: input.isDamaged ? input.damageType : "",
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

export interface BarcodeLookupResult {
  id: string;
  name: string;
  brand: string;
  model: string;
  salePrice: number;
  stock: number;
  lowStockThreshold: number;
}

export async function lookupProductByBarcode(barcode: string): Promise<BarcodeLookupResult | null> {
  await requireAuth();
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const product = await db.product.findFirst({ where: { barcode: trimmed, active: true } });
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    model: product.model,
    salePrice: product.salePrice,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
  };
}
