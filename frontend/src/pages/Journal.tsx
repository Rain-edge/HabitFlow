import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import Icon from "../components/Icon";
import { toast } from "../components/Layout";
import type { Habit, HabitRecord, JournalEntry } from "../types";
import { addDays, formatCN, todayISO, weekdayCN } from "../utils/date";

function RatingInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 0;
  return (
    <div>
      <label className="label flex items-center justify-between">
        <span>{label}</span>
        <span className="font-semibold text-brand-600">{v > 0 ? `${v}/10` : "未记录"}</span>
      </label>
      <input
        type="range"
        min="0"
        max="10"
        value={v}
        onChange={(e) => onChange(Number(e.target.value) === 0 ? null : Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function Journal() {
  const [params] = useSearchParams();
  const [date, setDate] = useState(params.get("date") || todayISO());
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [overall, setOverall] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [records, setRecords] = useState<HabitRecord[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [j, recs, habitList] = await Promise.all([
      api.get<JournalEntry>(`/journal/${date}`),
      api.get<HabitRecord[]>(`/records?on_date=${date}`),
      api.get<Habit[]>("/habits?include_deleted=true"),
    ]);
    setEntry(j);
    setMood(j.mood);
    setEnergy(j.energy);
    setOverall(j.overall);
    setStress(j.stress);
    setText(j.text ?? "");
    setRecords(recs);
    setHabits(habitList);
  }, [date]);

  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/journal/${date}`, { mood, energy, overall, stress, text: text || null });
      toast("日志已保存", "success");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const today = todayISO();
  const habitById = Object.fromEntries(habits.map((h) => [h.id, h]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="page-title truncate">{formatCN(date)}</h1>
          <p className="truncate text-xs text-ink-3">{weekdayCN(date)} · 每日生活日志</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-2.5" onClick={() => setDate(addDays(date, -1))} aria-label="前一天"><Icon name="prev" className="h-4 w-4" /></button>
          <input type="date" className="input w-36" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn-ghost px-2.5" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} aria-label="后一天"><Icon name="next" className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Day habits summary */}
      <section className="card card-pad">
        <h2 className="mb-2 text-sm font-semibold text-ink">当日习惯</h2>
        {records.length === 0 && <p className="text-xs text-ink-3">这一天没有打卡记录</p>}
        <div className="flex flex-wrap gap-2">
          {records.map((r) => {
            const h = habitById[r.habit_id];
            return (
              <span key={r.id} className="rounded-full bg-card-2 px-3 py-1 text-xs text-ink-2">
                {r.is_completed ? "✅" : "⬜"} {h?.icon} {h?.name ?? r.habit_id}
                {r.is_backfilled && " 🔧"}
              </span>
            );
          })}
        </div>
      </section>

      {/* Journal form */}
      <section className="card card-pad space-y-4">
        <h2 className="text-sm font-semibold text-ink">今日状态</h2>
        <RatingInput label="😊 心情" value={mood} onChange={setMood} />
        <RatingInput label="⚡ 精力" value={energy} onChange={setEnergy} />
        <RatingInput label="🌤️ 整体状态" value={overall} onChange={setOverall} />
        <RatingInput label="🌧️ 压力" value={stress} onChange={setStress} />
        <div>
          <label className="label">今日一句话 / 文字记录</label>
          <textarea
            className="input min-h-28"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天整体状态不错，运动也坚持下来了。"
          />
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "保存中…" : entry?.has_entry ? "更新日志" : "保存日志"}
          </button>
        </div>
      </section>
    </div>
  );
}
