// Label stickers are 2" x 1". Without an explicit @page rule the browser uses
// its default page margins (~0.4" a side), which leaves well under an inch of
// printable height -- so a 1" label overflows and the barcode lands on the NEXT
// sticker. Declaring the exact page size with zero margins makes one label fill
// exactly one sticker.
//
// The rule is injected only while a label print is in flight, because @page is
// global and would otherwise also apply to the receipt and A4 invoice.
const STYLE_ID = "label-page-size";

export function applyLabelPageSize(): () => void {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = "@page { size: 2in 1in; margin: 0; }";
  document.head.appendChild(style);
  return () => document.getElementById(STYLE_ID)?.remove();
}
