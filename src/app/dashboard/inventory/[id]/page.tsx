import { notFound } from "next/navigation";
import { getProduct, getSettings } from "@/lib/data";
import { auth } from "@/lib/auth";
import { ProductForm } from "./ProductForm";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const [product, settings, session] = await Promise.all([
    isNew ? Promise.resolve(null) : getProduct(id),
    getSettings(),
    auth(),
  ]);
  if (!isNew && !product) notFound();
  const isOwner = session?.user?.role === "OWNER";
  return <ProductForm product={product} isNew={isNew} isOwner={isOwner} barcodeWidth={settings.barcodeWidth} barcodeHeight={settings.barcodeHeight} />;
}
