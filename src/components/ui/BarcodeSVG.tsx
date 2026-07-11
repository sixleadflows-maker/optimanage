"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// CODE128 (not EAN-13/UPC) because it encodes any length of digits with no
// fixed-format or checksum requirement -- the right fit for internal codes,
// and every standard retail scanner reads it natively.
export function BarcodeSVG({
  value,
  width = 2,
  height = 50,
  fontSize = 12,
  displayValue = true,
  className,
}: {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width,
        height,
        fontSize,
        displayValue,
        margin: 4,
      });
    } catch {
      // Empty/invalid value for the symbology -- leave the SVG blank rather than throw.
    }
  }, [value, width, height, fontSize, displayValue]);

  return <svg ref={svgRef} className={className} />;
}
