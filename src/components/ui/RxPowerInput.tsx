"use client";

import { useEffect, useRef, useState } from "react";
import { formatRxPower, isRxTextValue, parseRxText, RX_TEXT_MARK, RX_TEXT_MAX } from "@/lib/utils/rx";

type Mode = "+" | "-" | "text";

const OPTIONS: { mode: Mode; label: string; title: string; tone: string }[] = [
  { mode: "+", label: "+", title: "Plus", tone: "bg-success/15 text-success" },
  { mode: "-", label: "−", title: "Minus", tone: "bg-primary/15 text-primary" },
  { mode: "text", label: "Aa", title: "Text — e.g. Plano", tone: "bg-warning/15 text-warning" },
];

/**
 * A lens power box (SPH, CYL, ADD). Phone and tablet number pads have a minus
 * but no plus, so the sign has its own button, which opens a choice of plus,
 * minus or text -- words such as "Plano" when that's what the slip says.
 * Typing + or - works as well, and the arrow keys step by 0.25.
 *
 * The value is the text as typed, sign first ("+2.5", "-1.25", "" for blank),
 * or RX_TEXT_MARK followed by the words in text mode.
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
  const [choosing, setChoosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Back to typing once a choice is made. Switching to or from text swaps the
  // box underneath, so this waits for the render that puts the new one in.
  const focusNext = useRef(false);
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    inputRef.current?.focus();
  });

  const isText = isRxTextValue(value);
  const words = isText ? value.slice(RX_TEXT_MARK.length) : "";
  const typedSign = value.startsWith("-") ? "-" : value.startsWith("+") ? "+" : "";
  const digits = isText ? "" : value.replace(/^[+-]/, "");
  // A number typed without a sign is a plus.
  const sign = typedSign || (parseRxText(digits) > 0 ? "+" : "");
  const mode: Mode | "" = isText ? "text" : sign;

  const typeDigits = (raw: string) => {
    const signs = raw.match(/[+-]/g);
    const nextSign = signs ? signs[signs.length - 1] : typedSign;
    const [whole, ...fraction] = raw.replace(/[^0-9.]/g, "").split(".");
    const nextDigits = fraction.length ? `${whole}.${fraction.join("")}` : whole;
    onChange(`${nextSign}${nextDigits}`);
  };

  const choose = (next: Mode) => {
    setChoosing(false);
    if (next === "text") {
      if (!isText) onChange(RX_TEXT_MARK);
    } else {
      onChange(`${next}${digits}`);
    }
    focusNext.current = true;
  };

  const step = (by: number) => {
    const next = Math.round((parseRxText(value) + by) * 100) / 100;
    onChange(formatRxPower(next));
  };

  const current = OPTIONS.find((o) => o.mode === mode);

  // The full size shrinks to the compact one when its box is narrow (phones,
  // or the half-width form on a small laptop), so the number stays readable.
  return (
    <div className="relative @container">
      <button
        type="button"
        onClick={() => setChoosing((v) => !v)}
        title="Plus, minus or text"
        aria-label={`${current ? current.title : "No sign yet"} — tap to choose plus, minus or text`}
        aria-expanded={choosing}
        className={`absolute top-1/2 -translate-y-1/2 left-0.5 w-4 h-4 flex items-center justify-center rounded-md font-bold cursor-pointer transition-colors ${
          isText ? "text-[8px]" : "text-[11px]"
        } ${
          compact ? "" : `@min-[76px]:left-1 @min-[76px]:w-6 @min-[76px]:h-6 ${isText ? "@min-[76px]:text-[10px]" : "@min-[76px]:text-sm"}`
        } ${current ? current.tone : "bg-surface-hover text-muted-foreground"}`}
      >
        {current ? current.label : "±"}
      </button>

      {choosing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setChoosing(false)} />
          <div role="menu" className="absolute left-0 top-full mt-1 z-30 flex gap-1 p-1 rounded-lg glass shadow-lg">
            {OPTIONS.map((o) => (
              <button
                key={o.mode}
                type="button"
                role="menuitem"
                title={o.title}
                onClick={() => choose(o.mode)}
                className={`w-7 h-7 rounded-md text-xs font-bold cursor-pointer transition-colors ${o.tone} ${
                  o.mode === mode ? "ring-2 ring-current" : "hover:opacity-80"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {isText ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="Text"
          maxLength={RX_TEXT_MAX}
          value={words}
          onChange={(e) => onChange(`${RX_TEXT_MARK}${e.target.value}`)}
          onBlur={() => onChange(`${RX_TEXT_MARK}${words.trim()}`)}
          className={`w-full glass-input text-center pl-5 pr-1 ${
            compact ? "py-1 text-[10px]" : "py-2 text-[11px] @min-[76px]:pl-8 @min-[76px]:pr-2 @min-[76px]:text-xs"
          }`}
        />
      ) : (
        <input
          ref={inputRef}
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
      )}
    </div>
  );
}
