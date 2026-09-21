"use client";

import { formatRxPower, parseRxText } from "@/lib/utils/rx";

/**
 * A lens power box (SPH, CYL, ADD). Phone and tablet number pads have a minus
 * but no plus, so the sign has its own button: tap it to switch between + and
 * −. Typing + or - works as well, and the arrow keys step by 0.25.
 *
 * The value is the text as typed, sign first ("+2.5", "-1.25", "" for blank).
 */
export function RxPowerInput({
  value,
  onChange,
  compact = false,
  placeholder = "0.00",
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
}) {
  const typedSign = value.startsWith("-") ? "-" : value.startsWith("+") ? "+" : "";
  const digits = value.replace(/^[+-]/, "");
  // A number typed without a sign is a plus.
  const sign = typedSign || (parseRxText(digits) > 0 ? "+" : "");

  const typeDigits = (raw: string) => {
    const signs = raw.match(/[+-]/g);
    const nextSign = signs ? signs[signs.length - 1] : typedSign;
    const [whole, ...fraction] = raw.replace(/[^0-9.]/g, "").split(".");
    const nextDigits = fraction.length ? `${whole}.${fraction.join("")}` : whole;
    onChange(`${nextSign}${nextDigits}`);
  };

  const flipSign = () => onChange(`${sign === "+" ? "-" : "+"}${digits}`);

  const step = (by: number) => {
    const next = Math.round((parseRxText(value) + by) * 100) / 100;
    onChange(formatRxPower(next));
  };

  // The full size shrinks to the compact one when its box is narrow (phones,
  // or the half-width form on a small laptop), so the number stays readable.
  return (
    <div className="relative @container">
      <button
        type="button"
        onClick={flipSign}
        title="Switch between plus and minus"
        aria-label={sign === "-" ? "Minus — tap for plus" : sign === "+" ? "Plus — tap for minus" : "Choose plus or minus"}
        className={`absolute top-1/2 -translate-y-1/2 left-0.5 w-4 h-4 text-[11px] flex items-center justify-center rounded-md font-bold cursor-pointer transition-colors ${
          compact ? "" : "@min-[76px]:left-1 @min-[76px]:w-6 @min-[76px]:h-6 @min-[76px]:text-sm"
        } ${
          sign === "+" ? "bg-success/15 text-success"
          : sign === "-" ? "bg-primary/15 text-primary"
          : "bg-surface-hover text-muted-foreground"
        }`}
      >
        {sign === "-" ? "−" : sign === "+" ? "+" : "±"}
      </button>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={digits}
        onChange={(e) => typeDigits(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); step(0.25); }
          if (e.key === "ArrowDown") { e.preventDefault(); step(-0.25); }
        }}
        onBlur={() => {
          // Written out in full once the number is in: "2.5" becomes "+2.50".
          if (digits.trim() && digits !== ".") onChange(formatRxPower(parseRxText(value)));
        }}
        className={`w-full glass-input text-center pl-5 pr-1 ${
          compact ? "py-1 text-[10px]" : "py-2 text-[11px] @min-[76px]:pl-8 @min-[76px]:pr-2 @min-[76px]:text-xs"
        }`}
      />
    </div>
  );
}
