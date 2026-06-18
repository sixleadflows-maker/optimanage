"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({ value, format, duration = 1200 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(() => format(0));
  const prevRef = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = prevRef.current;
    const target = value;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * ease;
      setDisplay(format(Math.round(current)));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    prevRef.current = target;
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, format, duration]);

  return <>{display}</>;
}
