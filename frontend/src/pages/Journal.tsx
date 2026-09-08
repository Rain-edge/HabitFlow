import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import HabitIcon from "../components/HabitIcon";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import { toast } from "../components/Layout";
import type { Habit, HabitRecord, JournalEntry } from "../types";
import { addDays, formatCN, todayISO, weekdayCN } from "../utils/date";

function RatingInput({
  icon,
  label,
  value,
  onChange,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const v = value ?? 0;
  return (
    <div>
      <label className="label flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Icon name={icon} className="h-4 w-4 text-ink-3" />
          {label}
        </span>
        <span className="font-display font-semibold text-brand-600 dark:text-brand-300">
          {v > 0 ? `${v}/10` : "未记录"}
        </span>
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
        <div className="flex shrink-0 items-center gap-1">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="前一天">
            <Icon name="prev" className="h-4 w-4" />
          </button>
          <input
            type="date"
            className="input w-36"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            className="icon-btn"
            disabled={date >= today}
            onClick={() => setDate(addDays(date, 1))}
            aria-label="后一天"
          >
            <Icon name="next" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day habits summary */}
      <section className="card card-pad">
        <h2 className="section-title mb-3">当日习惯</h2>
        {records.length === 0 && <p className="text-xs text-ink-3">这一天没有打卡记录</p>}
        <div className="flex flex-wrap gap-2">
          {records.map((r) => {
            const h = habitById[r.habit_id];
            return (
              <span key={r.id} className="flex items-center gap-1.5 rounded-full bg-card-2 px-3 py-1 text-xs text-ink-2">
                {r.is_completed ? (
                  <Icon name="check" className="h-3.5 w-3.5 text-success-500" strokeWidth={2.4} />
                ) : (
                  <Icon name="circle" className="h-3.5 w-3.5 text-ink-3" strokeWidth={2} />
                )}
                <span>
                  <HabitIcon icon={h?.icon ?? "sprout"} className="h-4 w-4" />
                </span>
                <span>{h?.name ?? r.habit_id}</span>
                {r.is_backfilled && <Icon name="wrench" className="h-3 w-3 text-warning-500" />}
              </span>
            );
          })}
        </div>
      </section>

      {/* Journal form */}
      <section className="card card-pad space-y-4">
        <h2 className="section-title">今日状态</h2>
        <RatingInput icon="smile" label="心情" value={mood} onChange={setMood} />
        <RatingInput icon="zap" label="精力" value={energy} onChange={setEnergy} />
        <RatingInput icon="sun" label="整体状态" value={overall} onChange={setOverall} />
        <RatingInput icon="cloud-rain" label="压力" value={stress} onChange={setStress} />
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
