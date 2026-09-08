import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { toast } from "../components/Layout";
import RecordDialog from "../components/RecordDialog";
import { EmptyState } from "../components/ui";
import type { Habit, HabitStats } from "../types";
import { monthGrid, parseISO, shortCN, todayISO } from "../utils/date";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="num mt-1 text-xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink-3">{sub}</div>}
    </div>
  );
}

export default function HabitDetail() {
  const { id } = useParams();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<HabitStats["values"][number] | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillDate, setBackfillDate] = useState("");

  const load = useCallback(async () => {
    const [h, s] = await Promise.all([api.get<Habit>(`/habits/${id}`), api.get<HabitStats>(`/statistics/habit/${id}`)]);
    setHabit(h);
    setStats(s);
  }, [id]);

  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, [load]);

  const completedSet = useMemo(() => new Set(stats?.completed_dates ?? []), [stats]);

  if (!habit || !stats) return <div className="py-20 text-center text-sm text-ink-3">加载中…</div>;

  const today = todayISO();
  const now = parseISO(today);
  const grid = monthGrid(now.getFullYear(), now.getMonth() + 1);
  const isWeekly = habit.schedule_type === "weekly_count";
  const streakUnit = stats.streak_unit === "week" ? "周" : "天";

  const trend = stats.values
    .filter((v) => v.value_number != null)
    .map((v) => ({ date: shortCN(v.date), value: v.value_number, completed: v.is_completed }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/habits" className="text-sm text-ink-3 hover:text-ink-2">
          ←
        </Link>
        <span className="flex h-11 w-11 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `${habit.color}22` }}>
          {habit.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{habit.name}</h1>
          <p className="text-xs text-ink-3">
            {habit.schedule_type === "daily" && "每天"}
            {habit.schedule_type === "weekly_count" && `每周 ${habit.weekly_target} 次`}
            {habit.schedule_type === "weekly_days" && `每周 ${(habit.weekly_days || []).map((d) => "一二三四五六日"[d]).join("、")}`}
            {habit.target_value != null && ` · 目标 ${habit.target_value} ${habit.unit || ""}`}
          </p>
        </div>
        <button
          className="btn-primary ml-auto shrink-0"
          onClick={() => {
            setEditingRecord(null);
            setDialogDate(today);
          }}
        >
          打卡
        </button>
      </div>

      {/* Core stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`🔥 当前连续`} value={`${stats.current_streak} ${streakUnit}`} />
        <StatCard label={`🏆 历史最长`} value={`${stats.longest_streak} ${streakUnit}`} />
        <StatCard label="📈 完成率" value={`${stats.completion_rate}%`} sub={isWeekly ? "按累计次数" : `${stats.total_completed}/${stats.expected_total}`} />
        <StatCard label="📊 累计完成" value={`${stats.total_completed} 次`} sub={`正常 ${stats.normal_completed} · 补签 ${stats.backfilled_completed}`} />
      </div>

      {isWeekly && stats.weekly && (
        <div className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span className="text-ink-2">本周进度</span>
          <span className="font-semibold text-ink">
            {stats.weekly.this_week_done}/{stats.weekly.target} 次
          </span>
          <span className="text-ink-2">
            达标周数 <b className="text-ink">{stats.weekly.weeks_met}</b>/{stats.weekly.weeks_total}
          </span>
        </div>
      )}

      {/* Period summary */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">近期概览</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["最近 7 天", stats.last_7_days],
            ["最近 30 天", stats.last_30_days],
            ["本周", stats.this_week],
            ["本月", stats.this_month],
          ].map(([label, p]) => {
            const period = p as { expected: number | null; completed: number; rate: number | null };
            return (
              <div key={label as string} className="rounded-xl bg-card-2 px-3 py-3 text-center">
                <div className="text-[11px] text-ink-3">{label as string}</div>
                <div className="mt-1 text-sm font-semibold text-ink">
                  {isWeekly ? `${period.completed} 次` : `${period.completed}/${period.expected}`}
                </div>
                {period.rate != null && <div className="text-[10px] text-ink-3">{period.rate}%</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Month calendar */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">本月日历</h2>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-3">
          {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((d, i) =>
            d ? (
              <div
                key={d}
                className={`flex h-9 items-center justify-center rounded-lg text-xs ${
                  completedSet.has(d)
                    ? "font-semibold text-white"
                    : d > today
                      ? "text-ink-3"
                      : "bg-card-2 text-ink-3"
                }`}
                style={completedSet.has(d) ? { backgroundColor: habit.color } : undefined}
              >
                {parseISO(d).getDate()}
              </div>
            ) : (
              <div key={`e${i}`} />
            )
          )}
        </div>
      </section>

      {/* Value trend */}
      {trend.length > 1 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">数值趋势</h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -22, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={habit.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={habit.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v} ${habit.unit || ""}`, "数值"]} />
                <Area type="monotone" dataKey="value" stroke={habit.color} fill="url(#vgrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* History */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">历史记录</h2>
          {habit.allow_backfill && (
            <button className="text-xs text-brand-600 hover:underline" onClick={() => setBackfillOpen((o) => !o)}>
              🔧 补签历史
            </button>
          )}
        </div>

        {backfillOpen && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-card-2 p-2">
            <input
              type="date"
              className="input flex-1"
              value={backfillDate}
              min={habit.start_date}
              max={today}
              onChange={(e) => setBackfillDate(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={() => {
                if (!backfillDate) return;
                setEditingRecord(null);
                setDialogDate(backfillDate);
              }}
            >
              记录该日
            </button>
          </div>
        )}

        {stats.values.length === 0 && <EmptyState icon="📋" title="还没有记录" desc="开始记录后，这里会显示完整的历史。" />}
        <div className="divide-y divide-line-2">
          {[...stats.values].reverse().slice(0, 60).map((v) => (
            <button
              key={v.date}
              className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-line-2"
              onClick={() => {
                setEditingRecord(v);
                setDialogDate(v.date);
              }}
            >
              <span className="text-ink-2">{v.date}</span>
              <span className="flex items-center gap-2 text-xs">
                {v.is_backfilled && <span className="rounded bg-warning-500/10 px-1.5 py-0.5 text-warning-600">🔧 补签</span>}
                <span className={v.is_completed ? "text-success-600" : "text-ink-3"}>
                  {v.is_completed ? "✅" : "⬜"}
                  {v.value_number != null && ` ${v.value_number}${habit.unit ? ` ${habit.unit}` : ""}`}
                  {v.value_text != null && ` ${v.value_text}`}
                  {v.value_time != null && ` ${v.value_time}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {dialogDate && (
        <RecordDialog
          habit={habit}
          recordDate={dialogDate}
          existing={
            editingRecord
              ? {
                  id: editingRecord.id,
                  value_number: editingRecord.value_number,
                  value_text: editingRecord.value_text,
                  value_time: editingRecord.value_time,
                  note: null,
                  is_backfilled: editingRecord.is_backfilled,
                }
              : null
          }
          onClose={() => {
            setDialogDate(null);
            setEditingRecord(null);
          }}
          onSaved={() => {
            load();
            toast("已保存", "success");
          }}
        />
      )}
    </div>
  );
}
