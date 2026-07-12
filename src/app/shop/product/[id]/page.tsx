import { notFound } from "next/navigation";
import { getProduct } from "@/lib/data";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product || product.stock <= 0) notFound();
  return <ProductDetailClient product={product} />;
}
