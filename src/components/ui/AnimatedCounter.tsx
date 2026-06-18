"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({ value, duration = 1200 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const raw = value.replace(/[^0-9.]/g, "");
    const target = parseFloat(raw);
    if (isNaN(target)) {
      setDisplay(value);
      return;
    }

    const prevRaw = prevRef.current.replace(/[^0-9.]/g, "");
    const start = parseFloat(prevRaw) || 0;
    const prefix = value.match(/^[^0-9]*/)?.[0] || "";
    const suffix = value.match(/[^0-9]*$/)?.[0] || "";
    const hasDecimal = raw.includes(".");
    const decimals = hasDecimal ? (raw.split(".")[1]?.length || 0) : 0;
    const useCommas = value.includes(",");

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * ease;

      let formatted = hasDecimal ? current.toFixed(decimals) : Math.round(current).toString();
      if (useCommas) {
        const [intPart, decPart] = formatted.split(".");
        formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decPart ? "." + decPart : "");
      }

      setDisplay(prefix + formatted + suffix);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    prevRef.current = value;

    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return <>{display}</>;
}
