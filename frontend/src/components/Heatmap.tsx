// GitHub-style year heatmap: one column per week, one row per weekday.
// Colors deepen with the day's completion rate; brand teal instead of green.
import { useEffect, useMemo, useRef, useState } from "react";
import { parseISO, shortCN, weekdayCN } from "../utils/date";
import type { HeatmapDay } from "../local/stats";

const LEVELS = [
  "bg-line-2/70", // no plan
  "bg-danger-500/15", // scheduled, 0% done — kept for warning semantics, softened visually
  "bg-brand-500/25",
  "bg-brand-500/60",
  "bg-brand-500",
] as const;

function levelOf(d: HeatmapDay): number {
  if (d.rate == null) return 0;
  if (d.rate === 0) return 1;
  if (d.rate < 50) return 2;
  if (d.rate < 100) return 3;
  return 4;
}

export default function Heatmap({ days }: { days: HeatmapDay[] }) {
  const [picked, setPicked] = useState<HeatmapDay | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Recent days live at the right edge — start there, not at the empty left side.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [days.length]);

  const { weeks, monthLabels } = useMemo(() => {
    if (days.length === 0) return { weeks: [] as (HeatmapDay | null)[][], monthLabels: [] as { col: number; label: string }[] };
    // Pad the head so the first column starts on Monday.
    const lead = (parseISO(days[0].date).getDay() + 6) % 7;
    const cells: (HeatmapDay | null)[] = [...Array.from({ length: lead }, () => null), ...days];
    const ws: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) ws.push(cells.slice(i, i + 7));
    // One label at the first week whose first real day enters a new month.
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    ws.forEach((w, col) => {
      const first = w.find((c) => c != null);
      if (!first) return;
      const m = parseISO(first.date).getMonth();
      if (m !== lastMonth) {
        labels.push({ col, label: `${m + 1}月` });
        lastMonth = m;
      }
    });
    return { weeks: ws, monthLabels: labels };
  }, [days]);

  if (days.length === 0) return null;

  return (
    <div>
      <div className="overflow-x-auto pb-1" ref={scrollRef}>
        {/* pr reserves room for the rightmost month label, which absolute
            positioning would otherwise clip outside the scroll width */}
        <div className="w-max pr-6">
          {/* month labels */}
          <div className="relative mb-1 h-4">
            {monthLabels.map(({ col, label }) => (
              <span key={`${col}-${label}`} className="absolute text-[10px] leading-4 text-ink-3" style={{ left: col * 13 }}>
                {label}
              </span>
            ))}
          </div>
          {/* grid: 7 rows, one column per week */}
          <div className="grid w-max grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 10px)", gridAutoColumns: "10px" }}>
            {weeks.flat().map((d, i) =>
              d ? (
                <button
                  key={d.date}
                  className={`h-[10px] w-[10px] rounded-[2px] transition ${LEVELS[levelOf(d)]} ${
                    picked?.date === d.date ? "ring-1 ring-ink ring-offset-1 ring-offset-card" : ""
                  }`}
                  onClick={() => setPicked((p) => (p?.date === d.date ? null : d))}
                  aria-label={`${d.date} 完成 ${d.done}/${d.expected}`}
                />
              ) : (
                <span key={`pad-${i}`} />
              )
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-3">
        <span>{picked ? `${shortCN(picked.date)} ${weekdayCN(picked.date)} · 完成 ${picked.done}/${picked.expected}${picked.rate != null ? `（${picked.rate}%）` : ""}` : "点格子看当天完成情况"}</span>
        <span className="flex items-center gap-1">
          少
          {LEVELS.map((c) => (
            <span key={c} className={`inline-block h-[10px] w-[10px] rounded-[2px] ${c}`} />
          ))}
          多
        </span>
      </div>
    </div>
  );
}
