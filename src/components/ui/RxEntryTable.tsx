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
const byField = (f: RxField) => FIELDS.find((x) => x.field === f)!;
// The till's cart column is narrow: five boxes in a row left each one about a
// character wide, so -3.25 was cut off and the text jumped about while typing.
// There the distance powers get a row of their own, and ADD and PD the next.
const ROWS_FULL = [FIELDS];
const ROWS_COMPACT = [["Sph", "Cyl", "Axis"], ["Add", "Pd"]].map((row) => row.map((f) => byField(f as RxField)));
// The reading box is laid out like the reading rows on the shop's own slip.
const READING_COLUMNS = ["D. Sph", "D. Cyl", "Axis"];

/**
 * Typing in a prescription as one table: a row per eye, the distance powers,
 * the ADD and the PD. Underneath, the reading power works itself out from the
 * distance SPH and the ADD, so it never has to be typed or worked out by hand,
 * in a table of its own drawn like the reading rows on the shop's slip.
 */
export function RxEntryTable({
  values, onChange, compact = false,
}: {
  values: RxFormValues;
  onChange: (key: `${Eye}${RxField}`, value: string) => void;
  compact?: boolean;
}) {
  // The reading powers: the SPH with the ADD put on, the CYL and axis as they are.
  const reading = (eye: Eye) => {
    const sph = readingSph(parseRxText(values[`${eye}Sph`]), parseRxText(values[`${eye}Add`]), rxTextOf(values[`${eye}Add`]));
    if (!sph) return null;
    const cyl = parseRxText(values[`${eye}Cyl`]);
    const cylText = rxTextOf(values[`${eye}Cyl`]);
    const axis = parseRxText(values[`${eye}Axis`]);
    return [sph, cyl || cylText ? formatRxPower(cyl, cylText) : "", axis ? String(axis) : ""];
  };
  const near = { right: reading("right"), left: reading("left") };
  const rows = compact ? ROWS_COMPACT : ROWS_FULL;
  const line = "border-foreground/30";
  const pad = compact ? "px-1 py-1.5" : "px-2 py-2";

  return (
    <div className={compact ? "space-y-1" : ""}>
      {rows.map((fields, r) => (
        <table key={r} className="w-full border-separate table-fixed" style={{ borderSpacing: compact ? "3px" : "6px" }}>
          <thead>
            <tr className={`${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground uppercase tracking-wide`}>
              <th className={`text-left font-medium ${compact ? "w-9" : "w-12"}`}>Eye</th>
              {fields.map((f) => <th key={f.field} className="font-medium">{f.label}</th>)}
              {/* Keeps ADD and PD the width of the boxes above them. */}
              {fields.length < rows[0].length && <th aria-hidden />}
            </tr>
          </thead>
          <tbody>
            {(["right", "left"] as const).map((eye) => (
              <tr key={eye}>
                <td className={`${compact ? "text-[10px]" : "text-xs"} font-semibold`}>{eye === "right" ? "Right" : "Left"}</td>
                {fields.map(({ field }) => {
                  const key = `${eye}${field}` as const;
                  return (
                    <td key={field}>
                      {field === "Sph" || field === "Cyl" || field === "Add" ? (
                        <RxPowerInput compact={compact} placeholder="0" value={values[key]} onChange={(v) => onChange(key, v)} />
                      ) : (
                        <input type="number" step={field === "Axis" ? 1 : 0.5} min={0} placeholder="0"
                          aria-label={`${eye === "right" ? "Right" : "Left"} ${field.toUpperCase()}`}
                          value={values[key]} onChange={(e) => onChange(key, e.target.value)}
                          className={`w-full glass-input text-center ${compact ? "px-1 py-1.5 text-[11px]" : "px-2 py-2 text-xs"}`} />
                      )}
                    </td>
                  );
                })}
                {fields.length < rows[0].length && <td aria-hidden />}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {(near.right || near.left) && (
        <div className={compact ? "mt-1.5" : "mt-2"} style={{ paddingInline: compact ? "3px" : "6px" }}>
          <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-semibold mb-1`}>
            Reading <span className="font-normal text-muted-foreground">— SPH + ADD, filled in for you</span>
          </p>
          {/* The same columns as the boxes above, so D. Sph sits under SPH. */}
          <table className={`w-full table-fixed border-separate text-center tabular-nums ${compact ? "text-[11px]" : "text-xs"}`} style={{ borderSpacing: 0 }}>
            <colgroup>
              <col className={compact ? "w-9" : "w-12"} />
              {rows[0].map((f) => <col key={f.field} />)}
            </colgroup>
            <thead>
              <tr className={`${compact ? "text-[10px]" : "text-[11px]"} text-foreground/80`}>
                <th aria-hidden />
                {READING_COLUMNS.map((label) => <th key={label} className="font-semibold pb-1">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(["right", "left"] as const).map((eye, i) => {
                // A box with rounded corners around both rows, a line between them.
                const edge = i === 0 ? "border-t" : "border-t border-b";
                return (
                  <tr key={eye}>
                    <td className={`${edge} border-l ${i === 0 ? "rounded-tl-xl" : "rounded-bl-xl"} ${line} ${pad} text-left font-semibold`}>
                      {eye === "right" ? "Right" : "Left"}
                    </td>
                    {(near[eye] ?? ["", "", ""]).map((v, c) => (
                      <td key={READING_COLUMNS[c]}
                        className={`${edge} border-l ${c === 2 ? `border-r ${i === 0 ? "rounded-tr-xl" : "rounded-br-xl"}` : ""} ${line} ${pad} font-semibold`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
