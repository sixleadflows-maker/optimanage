import { formatEyeValue, readingSph } from "@/lib/utils/rx";

interface EyeValues {
  sph: number; cyl: number; axis: number; pd: number; add: number;
  sphText?: string; cylText?: string; addText?: string;
}

/**
 * A prescription the way an optician's slip lays it out: one row per eye, the
 * distance powers, then the reading powers (distance SPH with the ADD put on;
 * CYL and axis stay the same), then the ADD and PD. With no ADD the reading
 * columns read "—".
 */
export function RxTable({ right, left }: { right: EyeValues; left: EyeValues }) {
  const rows = [["Right", right], ["Left", left]] as const;
  const axis = (e: EyeValues) => (e.axis ? String(e.axis) : "—");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center tabular-nums text-[11px] border-collapse">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-muted-foreground">
            <th rowSpan={2} className="text-left font-medium align-bottom pb-1 pr-2">Eye</th>
            <th colSpan={3} className="font-semibold pb-0.5 border-b border-border">Distance</th>
            <th colSpan={3} className="font-semibold pb-0.5 border-b border-l border-border">Reading</th>
            <th rowSpan={2} className="font-medium align-bottom pb-1 border-l border-border">Add</th>
            <th rowSpan={2} className="font-medium align-bottom pb-1">PD</th>
          </tr>
          <tr className="text-[9px] text-muted-foreground">
            <th className="font-medium py-1">D. SPH</th>
            <th className="font-medium py-1">D. CYL</th>
            <th className="font-medium py-1">Axis</th>
            <th className="font-medium py-1 border-l border-border">R. SPH</th>
            <th className="font-medium py-1">R. CYL</th>
            <th className="font-medium py-1">Axis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([eye, e]) => {
            const near = readingSph(e.sph, e.add, e.addText);
            return (
              <tr key={eye} className="border-t border-border">
                <td className="text-left py-1.5 pr-2 font-medium text-muted-foreground">{eye}</td>
                <td className="py-1.5 font-semibold">{formatEyeValue("Sph", e)}</td>
                <td className="py-1.5 font-semibold">{formatEyeValue("Cyl", e)}</td>
                <td className="py-1.5 font-semibold">{axis(e)}</td>
                <td className="py-1.5 font-semibold border-l border-border">{near || "—"}</td>
                <td className="py-1.5 font-semibold">{near ? formatEyeValue("Cyl", e) : "—"}</td>
                <td className="py-1.5 font-semibold">{near ? axis(e) : "—"}</td>
                <td className="py-1.5 border-l border-border">{e.add || e.addText ? formatEyeValue("Add", e) : "—"}</td>
                <td className="py-1.5">{e.pd ? String(e.pd) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
