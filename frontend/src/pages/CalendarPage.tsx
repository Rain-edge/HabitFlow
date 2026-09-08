import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import Icon from "../components/Icon";
import { toast } from "../components/Layout";
import RecordDialog from "../components/RecordDialog";
import type { CalendarDay, Habit, HabitRecord } from "../types";
import { monthGrid, parseISO, todayISO } from "../utils/date";

const STATUS_STYLE: Record<CalendarDay["status"], string> = {
  full: "bg-success-500 text-white",
  partial: "bg-warning-500 text-white",
  none: "bg-danger-500/10 text-danger-500",
  empty: "bg-card-2 text-ink-3",
  future: "text-ink-3",
};

export default function CalendarPage() {
  const today = todayISO();
  const now = parseISO(today);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selected, setSelected] = useState<string>(today);
  const [records, setRecords] = useState<HabitRecord[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [editRecord, setEditRecord] = useState<HabitRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  const quickBackfill = async (h: Habit) => {
    setSavingId(h.id);
    try {
      await api.post("/records", {
        habit_id: h.id,
        record_date: selected,
        is_completed: true,
      });
      await Promise.all([loadDay(), loadMonth()]);
      toast("已补签", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingId(null);
    }
  };

  const loadMonth = useCallback(async () => {
    const cal = await api.get<{ days: CalendarDay[] }>(`/statistics/calendar?year=${year}&month=${month}`);
    setDays(cal.days);
  }, [year, month]);

  const loadDay = useCallback(async () => {
    const [recs, habitList] = await Promise.all([
      api.get<HabitRecord[]>(`/records?on_date=${selected}`),
      api.get<Habit[]>("/habits?include_deleted=true"),
    ]);
    setRecords(recs);
    setHabits(habitList);
  }, [selected]);

  useEffect(() => {
    loadMonth().catch((e) => toast((e as Error).message, "error"));
  }, [loadMonth]);
  useEffect(() => {
    loadDay().catch((e) => toast((e as Error).message, "error"));
  }, [loadDay]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setYear(y);
    setMonth(m);
  };

  const grid = monthGrid(year, month);
  const dayStatus = Object.fromEntries(days.map((d) => [d.date, d]));

  const habitById = Object.fromEntries(habits.map((h) => [h.id, h]));
  const unrecordedHabits = habits.filter(
    (h) => !h.deleted_at && h.schedule_type !== "weekly_count" && !records.some((r) => r.habit_id === h.id)
  );

  const legend = [
    ["全部完成", "bg-success-500"],
    ["部分完成", "bg-warning-500"],
    ["未完成", "bg-danger-500"],
    ["无计划", "bg-line-2"],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">
          {year} 年 {month} 月
        </h1>
        <div className="flex gap-1">
          <button className="btn-ghost px-3" onClick={() => shiftMonth(-1)} aria-label="上一月"><Icon name="prev" className="h-4 w-4" /></button>
          <button
            className="btn-ghost"
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth() + 1);
              setSelected(today);
            }}
          >
            今天
          </button>
          <button className="btn-ghost px-3" onClick={() => shiftMonth(1)} aria-label="下一月"><Icon name="next" className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-3">
          {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const st = dayStatus[d]?.status ?? "empty";
            const isSel = d === selected;
            return (
              <button
                key={d}
                className={`flex h-11 flex-col items-center justify-center rounded-xl text-xs transition ${STATUS_STYLE[st]} ${
                  isSel ? "ring-2 ring-brand-500 ring-offset-1" : ""
                }`}
                onClick={() => setSelected(d)}
              >
                <span className="font-medium">{parseISO(d).getDate()}</span>
                {st !== "future" && st !== "empty" && dayStatus[d] && (
                  <span className="text-[9px] opacity-80">
                    {dayStatus[d].done}/{dayStatus[d].expected}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-3">
          {legend.map(([label, cls]) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded ${cls}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Selected day panel */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{selected} 的记录</h2>
          {selected <= today && (
            <button className="text-xs text-brand-600 hover:underline" onClick={() => setAdding(true)}>
              ＋ 补录
            </button>
          )}
        </div>

        {records.length === 0 && !adding && (
          <p className="py-3 text-center text-xs text-ink-3">这一天没有记录</p>
        )}

        <div className="space-y-2">
          {records.map((r) => {
            const h = habitById[r.habit_id];
            return (
              <button
                key={r.id}
                className="flex w-full items-center gap-3 rounded-xl border border-line-2 p-2.5 text-left hover:bg-line-2"
                onClick={() => setEditRecord(r)}
              >
                <span className="text-lg">{h?.icon ?? "🌱"}</span>
                <span className="flex-1 text-sm text-ink">{h?.name ?? `习惯 ${r.habit_id}`}</span>
                <span className="text-xs text-ink-3">
                  {r.is_backfilled && "🔧 "}
                  {r.is_completed ? "✅" : "⬜"}
                  {r.value_number != null && ` ${r.value_number}${h?.unit ? ` ${h.unit}` : ""}`}
                  {r.value_text && ` ${r.value_text}`}
                  {r.value_time && ` ${r.value_time}`}
                </span>
              </button>
            );
          })}
        </div>

        {adding && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {unrecordedHabits.map((h) => (
              <button
                key={h.id}
                disabled={savingId === h.id}
                className="rounded-xl border border-dashed border-line p-2 text-xs text-ink-2 hover:border-brand-400 hover:text-brand-600"
                onClick={() => {
                  if (h.record_type === "boolean") void quickBackfill(h);
                  else setEditRecord({ ...emptyRecord(h.id), habit_id: h.id });
                }}
              >
                {savingId === h.id ? "…" : `${h.icon} ${h.name}${h.record_type === "boolean" ? " ⚡" : ""}`}
              </button>
            ))}
          </div>
        )}
      </section>

      {(editRecord || (adding && false)) && editRecord && (
        <RecordDialog
          habit={habitById[editRecord.habit_id]}
          recordDate={selected}
          existing={
            editRecord.id > 0
              ? {
                  id: editRecord.id,
                  value_number: editRecord.value_number,
                  value_text: editRecord.value_text,
                  value_time: editRecord.value_time,
                  note: editRecord.note,
                  is_backfilled: editRecord.is_backfilled,
                }
              : null
          }
          onClose={() => {
            setEditRecord(null);
            setAdding(false);
          }}
          onSaved={() => {
            loadDay();
            loadMonth();
            toast("已保存", "success");
          }}
        />
      )}
    </div>
  );
}

function emptyRecord(habitId: number): HabitRecord {
  return {
    id: -1,
    habit_id: habitId,
    record_date: "",
    value_number: null,
    value_text: null,
    value_time: null,
    is_completed: false,
    is_backfilled: false,
    note: null,
    created_at: "",
    updated_at: "",
  };
}
