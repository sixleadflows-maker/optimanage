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
  const taken = new Set(existing.map((p) => p.barcode));
  let max = 0;
  for (const p of existing) {
    const n = parseInt(p.barcode.slice(INTERNAL_BARCODE_PREFIX.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  // Step past anything already in use rather than trusting max+1 blindly.
  let next = max + 1;
  let candidate = INTERNAL_BARCODE_PREFIX + String(next).padStart(6, "0");
  while (taken.has(candidate)) {
    next++;
    candidate = INTERNAL_BARCODE_PREFIX + String(next).padStart(6, "0");
  }
  return candidate;
}

const norm = (value: string) => value.trim().toLowerCase();

// A blank value means "not recorded", not "different" -- so an item entered
// without a colour/size still matches the same article that has one. Only a
// stated-and-different value rules a match out.
const softMatch = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === "" || y === "" || x === y;
};

// Finds the existing catalogue row for the same article, so another box of
// stock tops up that row instead of creating a duplicate. An article is
// identified by brand + model (the article number), with colour and size only
// separating variants when both sides actually state them.
//
// A matching BARCODE deliberately does NOT count as a match any more. It used
// to, and it caused real damage: the Add Product form generates a barcode when
// it opens, so a form that had been sat open (or was restored from the router
// cache when staff went back to add the next frame) still held a number that
// had since been given to the product just saved. Saving then looked like "same
// barcode = same article" and quietly added the new frame's stock onto the
// previous one instead of creating it -- the disappearing products and stock
// counts creeping up on their own. Barcodes now only ever identify a product
// for scanning, never for merging.
//
// Damaged items are excluded on purpose: they're priced to their condition, so
// they stay their own row and never absorb (or get absorbed by) good stock.
async function findDuplicateProduct(input: ProductInput) {
  if (input.isDamaged) return null;

  // Without both a brand and an article number there isn't enough to identify
  // the item confidently -- better a new row than silently merging the wrong one.
  const brand = input.brand.trim();
  const model = input.model.trim();
  if (!brand || !model) return null;

  const candidates = await db.product.findMany({
    where: {
      active: true,
      isDamaged: false,
      brand: { equals: brand, mode: "insensitive" },
      model: { equals: model, mode: "insensitive" },
    },
  });
  return candidates.find((c) => softMatch(c.colour, input.colour) && softMatch(c.size, input.size)) ?? null;
}

// Lets the add-product form tell the user *before* they save that this article
// is already in the catalogue and saving will top up its stock.
export async function checkExistingProduct(input: ProductInput) {
  await requireAuth();
  const match = await findDuplicateProduct(input);
  if (!match) return { found: false as const };
  return {
    found: true as const,
    id: match.id,
    name: `${match.brand} ${match.name}`.trim(),
    model: match.model,
    colour: match.colour,
    stock: match.stock,
  };
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

  // Assign the barcode at save time, not when the form opened. If the incoming
  // one is blank or already belongs to another product (a stale form), issue a
  // fresh number rather than creating a second product with the same barcode --
  // scan-to-cart at the till can only match one product per barcode.
  let barcode = input.barcode.trim();
  if (barcode) {
    const clash = await db.product.findFirst({ where: { barcode }, select: { id: true } });
    if (clash) barcode = "";
  }
  if (!barcode) barcode = await nextBarcodeValue();

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
  // Soft delete to preserve sale history references. deletedAt drives the
  // 30-day restore window on the Trash page.
  await db.product.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/trash");
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
