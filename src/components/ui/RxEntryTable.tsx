"use client";

import { RxPowerInput } from "@/components/ui/RxPowerInput";
import { formatRxPower, parseRxText, readingSph, rxTextOf, type RxField } from "@/lib/utils/rx";

type Eye = "right" | "left";
export type RxFormValues = Record<`${Eye}${RxField}`, string>;

const FIELDS: { field: RxField; label: string }[] = [
  { field: "Sph", label: "D. SPH" },
  { field: "Cyl", label: "D. CYL" },
  { field: "Axis", label: "Axis" },
  { field: "Add", label: "Add" },
  { field: "Pd", label: "PD" },
];

/**
 * Typing in a prescription as one table: a row per eye, the distance powers,
 * the ADD and the PD. Underneath, the reading power works itself out from the
 * distance SPH and the ADD, so it never has to be typed or worked out by hand.
 */
export function RxEntryTable({
  values, onChange, compact = false,
}: {
  values: RxFormValues;
  onChange: (key: `${Eye}${RxField}`, value: string) => void;
  compact?: boolean;
}) {
  const reading = (eye: Eye) => {
    const near = readingSph(parseRxText(values[`${eye}Sph`]), parseRxText(values[`${eye}Add`]), rxTextOf(values[`${eye}Add`]));
    if (!near) return "";
    const cyl = parseRxText(values[`${eye}Cyl`]);
    const cylText = rxTextOf(values[`${eye}Cyl`]);
    const axis = parseRxText(values[`${eye}Axis`]);
    return [near, cyl || cylText ? `/ ${formatRxPower(cyl, cylText)}` : "", axis ? `× ${axis}` : ""].filter(Boolean).join(" ");
  };
  const near = { right: reading("right"), left: reading("left") };

  return (
    <div>
      <table className="w-full border-separate table-fixed" style={{ borderSpacing: compact ? "3px" : "6px" }}>
        <thead>
          <tr className={`${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground uppercase tracking-wide`}>
            <th className={`text-left font-medium ${compact ? "w-9" : "w-12"}`}>Eye</th>
            {FIELDS.map((f) => <th key={f.field} className="font-medium">{f.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {(["right", "left"] as const).map((eye) => (
            <tr key={eye}>
              <td className={`${compact ? "text-[10px]" : "text-xs"} font-semibold`}>{eye === "right" ? "Right" : "Left"}</td>
              {FIELDS.map(({ field }) => {
                const key = `${eye}${field}` as const;
                return (
                  <td key={field}>
                    {field === "Sph" || field === "Cyl" || field === "Add" ? (
                      <RxPowerInput compact={compact} placeholder="0" value={values[key]} onChange={(v) => onChange(key, v)} />
                    ) : (
                      <input type="number" step={field === "Axis" ? 1 : 0.5} min={0} placeholder="0"
                        aria-label={`${eye === "right" ? "Right" : "Left"} ${field.toUpperCase()}`}
                        value={values[key]} onChange={(e) => onChange(key, e.target.value)}
                        className={`w-full glass-input text-center ${compact ? "px-1 py-1 text-[10px]" : "px-2 py-2 text-xs"}`} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {(near.right || near.left) && (
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} mt-1 px-1 tabular-nums`}>
          <span className="font-semibold">Reading (near): </span>
          <span className="text-muted-foreground">{`Right ${near.right || "—"}  ·  Left ${near.left || "—"}`}</span>
        </p>
      )}
    </div>
  );
}
