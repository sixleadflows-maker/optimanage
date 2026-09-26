"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { searchCustomers, type CustomerSearchHit } from "@/lib/actions/customers";

export interface ProductSearchResult {
  id: string;
  label: string;
  model: string;
  barcode: string;
  salePrice: number;
  stock: number;
  lowStockThreshold: number;
}

export type GlobalSearchResult =
  | { ok: true; products: ProductSearchResult[]; customers: CustomerSearchHit[] }
  | { ok: false; error: string };

/**
 * The search box at the top of every screen, in one request: a product by its
 * scanned barcode or by name, brand or model, and a customer by serial number,
 * name or phone.
 */
export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You've been signed out — sign in again to search" };
  const q = query.trim();
  if (!q) return { ok: true, products: [], customers: [] };

  // A single character is only ever a scanned code, never worth a name search.
  const byText = q.length >= 2;
  // Every word has to match somewhere, in any field: "titan 7002" finds brand
  // TITAN with model 7002, and "Ray-Ban" finds products saved as "RAYBAN".
  const words = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const [rows, customers] = await Promise.all([
    db.product.findMany({
      where: {
        active: true,
        OR: [
          { barcode: q },
          ...(byText && words.length
            ? [{
                AND: words.map((w) => ({
                  OR: [
                    { name: { contains: w, mode: "insensitive" as const } },
                    { brand: { contains: w, mode: "insensitive" as const } },
                    { model: { contains: w, mode: "insensitive" as const } },
                  ],
                })),
              }]
            : []),
        ],
      },
      select: { id: true, brand: true, name: true, model: true, barcode: true, salePrice: true, stock: true, lowStockThreshold: true },
      orderBy: { name: "asc" },
      take: 6,
    }),
    byText ? searchCustomers(q) : Promise.resolve([] as CustomerSearchHit[]),
  ]);

  // A scanned barcode is what was meant -- it goes first.
  rows.sort((a, b) => Number(b.barcode === q) - Number(a.barcode === q));
  return {
    ok: true,
    products: rows.map((p) => ({
      id: p.id,
      label: [p.brand, p.name].map((s) => s.trim()).filter(Boolean).join(" "),
      model: p.model,
      barcode: p.barcode,
      salePrice: p.salePrice,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
    })),
    customers,
  };
}
