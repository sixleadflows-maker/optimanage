import { notFound } from "next/navigation";
import { getProduct } from "@/lib/data";
import { ProductForm } from "./ProductForm";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const product = isNew ? null : await getProduct(id);
  if (!isNew && !product) notFound();
  return <ProductForm product={product} isNew={isNew} />;
}
