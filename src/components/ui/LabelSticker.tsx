"use client";

import { formatCurrency } from "@/lib/utils/format";
import { BarcodeSVG } from "@/components/ui/BarcodeSVG";

// The 2" x 1" barcode sticker. Used for the on-screen preview AND for the
// actual printout (via PrintPortal), so what staff see is exactly what the
// label printer produces.
export function LabelSticker({
  title,
  price,
  barcode,
  barcodeWidth,
  barcodeHeight,
  fontSize = 8,
  bordered = false,
}: {
  title: string;
  price: number;
  barcode: string;
  barcodeWidth: number;
  barcodeHeight: number;
  fontSize?: number;
  bordered?: boolean;
}) {
  return (
    <div
      className={`product-label bg-white text-black flex flex-col items-center justify-center overflow-hidden ${bordered ? "rounded-lg border border-gray-200" : ""}`}
      style={{ width: "2in", height: "1in" }}
    >
      <p className="text-[6px] font-semibold text-center leading-tight px-1 w-full truncate">{title}</p>
      <p className="text-[7px] font-bold leading-tight">{formatCurrency(price)}</p>
      {barcode ? (
        <BarcodeSVG value={barcode} width={barcodeWidth} height={barcodeHeight} fontSize={fontSize} />
      ) : (
        <p className="text-[9px] text-gray-400 mt-2">No barcode yet</p>
      )}
    </div>
  );
}
