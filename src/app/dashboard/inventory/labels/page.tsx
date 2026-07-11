import { getProducts, getSettings } from "@/lib/data";
import { LabelsClient } from "./LabelsClient";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const [products, settings] = await Promise.all([getProducts(), getSettings()]);
  return <LabelsClient products={products} barcodeWidth={settings.barcodeWidth} barcodeHeight={settings.barcodeHeight} />;
}
