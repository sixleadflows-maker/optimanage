import { notFound } from "next/navigation";
import { getProduct, getSettings } from "@/lib/data";
import { ProductForm } from "./ProductForm";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const [product, settings] = await Promise.all([
    isNew ? Promise.resolve(null) : getProduct(id),
    getSettings(),
  ]);
  if (!isNew && !product) notFound();
  return <ProductForm product={product} isNew={isNew} barcodeWidth={settings.barcodeWidth} barcodeHeight={settings.barcodeHeight} />;
}
