"use client";

import { RxPowerInput } from "@/components/ui/RxPowerInput";
import { parseRxText, readingPowers, rxTextOf, type RxField, type RxReadingField } from "@/lib/utils/rx";

type Eye = "right" | "left";
export type RxFormValues = Record<`${Eye}${RxField}` | RxReadingField, string>;

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
// The reading boxes are laid out like the reading rows on the shop's own slip.
const READING_COLUMNS = [
  { field: "Sph", label: "D. Sph" },
  { field: "Cyl", label: "D. Cyl" },
  { field: "Axis", label: "Axis" },
] as const;

/**
 * Typing in a prescription as one table: a row per eye, the distance powers,
 * the ADD and the PD. Underneath, the reading power has boxes of its own,
 * drawn like the reading rows on the shop's slip: each one fills in from the
 * distance SPH and the ADD until something is typed in it, so a slip that only
 * gives the reading (or gives it differently) can be written as it is.
 */
export function RxEntryTable({
  values, onChange, compact = false,
}: {
  values: RxFormValues;
  onChange: (key: keyof RxFormValues, value: string) => void;
  compact?: boolean;
}) {
  // What each reading box stands for while it's empty: SPH + ADD, CYL and axis as for distance.
  const workedOut = (eye: Eye) => readingPowers({
    sph: parseRxText(values[`${eye}Sph`]), cyl: parseRxText(values[`${eye}Cyl`]), axis: parseRxText(values[`${eye}Axis`]),
    add: parseRxText(values[`${eye}Add`]), cylText: rxTextOf(values[`${eye}Cyl`]), addText: rxTextOf(values[`${eye}Add`]),
  });
  const near = { right: workedOut("right"), left: workedOut("left") };
  const rows = compact ? ROWS_COMPACT : ROWS_FULL;
  const spacing = { borderSpacing: compact ? "3px" : "6px" };
  const headCell = `${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground uppercase tracking-wide`;
  const eyeCell = `${compact ? "text-[10px]" : "text-xs"} font-semibold`;
  const numberBox = `w-full glass-input text-center ${compact ? "px-1 py-1.5 text-[11px]" : "px-2 py-2 text-xs"}`;

  return (
    <div className={compact ? "space-y-1" : ""}>
      {rows.map((fields, r) => (
        <table key={r} className="w-full border-separate table-fixed" style={spacing}>
          <thead>
            <tr className={headCell}>
              <th className={`text-left font-medium ${compact ? "w-9" : "w-12"}`}>Eye</th>
              {fields.map((f) => <th key={f.field} className="font-medium">{f.label}</th>)}
              {/* Keeps ADD and PD the width of the boxes above them. */}
              {fields.length < rows[0].length && <th aria-hidden />}
            </tr>
          </thead>
          <tbody>
            {(["right", "left"] as const).map((eye) => (
              <tr key={eye}>
                <td className={eyeCell}>{eye === "right" ? "Right" : "Left"}</td>
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
                          className={numberBox} />
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

      <div className={compact ? "mt-1.5" : "mt-2"} style={{ paddingInline: compact ? "3px" : "6px" }}>
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-semibold`}>
          Reading{" "}
          <span className="font-normal text-muted-foreground">
            {near.right[0] || near.left[0] ? "— filled in from SPH + ADD; type in a box to change it" : "— type it in, or it fills in from SPH + ADD"}
          </span>
        </p>
      </div>
      {/* The same columns as the boxes above, so D. Sph sits under SPH. */}
      <table className="w-full border-separate table-fixed" style={spacing}>
        <thead>
          <tr className={headCell}>
            <th className={`text-left font-medium ${compact ? "w-9" : "w-12"}`}>Eye</th>
            {READING_COLUMNS.map((c) => <th key={c.field} className="font-medium">{c.label}</th>)}
            {rows[0].slice(READING_COLUMNS.length).map((f) => <th key={f.field} aria-hidden />)}
          </tr>
        </thead>
        <tbody>
          {(["right", "left"] as const).map((eye) => (
            <tr key={eye}>
              <td className={eyeCell}>{eye === "right" ? "Right" : "Left"}</td>
              {READING_COLUMNS.map(({ field }, c) => {
                const key = `${eye}Read${field}` as const;
                const worked = near[eye][c];
                return (
                  <td key={field}>
                    {field === "Axis" ? (
                      <input type="number" step={1} min={0} placeholder={worked || "0"}
                        aria-label={`${eye === "right" ? "Right" : "Left"} reading axis`}
                        value={values[key]} onChange={(e) => onChange(key, e.target.value)}
                        className={`${numberBox} ${worked ? "placeholder:text-foreground/70" : ""}`} />
                    ) : (
                      <RxPowerInput compact={compact} placeholder={worked || "0"} placeholderIsValue={!!worked}
                        value={values[key]} onChange={(v) => onChange(key, v)} />
                    )}
                  </td>
                );
              })}
              {rows[0].slice(READING_COLUMNS.length).map((f) => <td key={f.field} aria-hidden />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
