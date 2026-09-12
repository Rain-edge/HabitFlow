import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import HabitIcon from "../components/HabitIcon";
import Icon from "../components/Icon";
import { toast } from "../components/Layout";
import RecordDialog from "../components/RecordDialog";
import { EmptyState, StatCard } from "../components/ui";
import type { Habit, HabitStats } from "../types";
import { monthGrid, parseISO, shortCN, todayISO } from "../utils/date";
import { scheduleLabel } from "../utils/schedule";

function monthLabelCN(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
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
    .map((v) => ({ date: shortCN(v.date), value: v.value_number as number, completed: v.is_completed }));

  // Y 轴聚焦数据范围（不从 0 起）；目标值纳入 domain 保证虚线始终可见
  const target = habit.target_value;
  const trendValues = trend.map((t) => t.value);
  const yMin = Math.min(...trendValues, ...(target != null ? [target] : []));
  const yMax = Math.max(...trendValues, ...(target != null ? [target] : []));
  const yPad = yMax - yMin > 0 ? (yMax - yMin) * 0.15 : Math.max(Math.abs(yMax) * 0.1, 1);
  const yDomain: [number, number] = [yMin - yPad, yMax + yPad];

  // 历史记录按月分组（最近 60 条，最新月份在前）；相邻同月归并，依赖入参按日期升序（stats 层已 sort 保证）
  const historyGroups = (() => {
    const recent = [...stats.values].reverse().slice(0, 60);
    const groups: { month: string; items: typeof recent }[] = [];
    for (const v of recent) {
      const month = v.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.items.push(v);
      else groups.push({ month, items: [v] });
    }
    return groups;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/habits" className="icon-btn -ml-1.5 shrink-0" aria-label="返回习惯列表">
          <Icon name="left" className="h-5 w-5" />
        </Link>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${habit.color}2E` }}>
          <HabitIcon icon={habit.icon} className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{habit.name}</h1>
          <p className="truncate text-xs text-ink-3">
            {scheduleLabel(habit)}
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
        <StatCard label="当前连续" value={`${stats.current_streak} ${streakUnit}`} accent="flame" />
        <StatCard label="历史最长" value={`${stats.longest_streak} ${streakUnit}`} />
        <StatCard
          label="完成率"
          value={`${stats.completion_rate}%`}
          sub={isWeekly ? "按累计次数" : `${stats.total_completed}/${stats.expected_total}`}
          accent="brand"
        />
        <StatCard
          label="累计完成"
          value={`${stats.total_completed} 次`}
          sub={`正常 ${stats.normal_completed} · 补签 ${stats.backfilled_completed}`}
        />
      </div>

      {isWeekly && stats.weekly && (
        <div className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span className="text-ink-2">本周进度</span>
          <span className="font-display font-semibold text-ink">
            {stats.weekly.this_week_done}/{stats.weekly.target} 次
          </span>
          <span className="text-ink-2">
            达标周数 <b className="font-display text-ink">{stats.weekly.weeks_met}</b>/{stats.weekly.weeks_total}
          </span>
        </div>
      )}

      {/* Period summary */}
      <section className="card p-4 sm:p-5">
        <h2 className="section-title mb-3">近期概览</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["最近 7 天", stats.last_7_days],
            ["最近 30 天", stats.last_30_days],
            ["本周", stats.this_week],
            ["本月", stats.this_month],
          ].map(([label, p]) => {
            const period = p as { expected: number | null; completed: number; rate: number | null };
            return (
              <div key={label as string} className="rounded-lg bg-card-2 px-3 py-3 text-center">
                <div className="text-[11px] text-ink-3">{label as string}</div>
                <div className="font-display mt-1 text-sm font-semibold text-ink">
                  {isWeekly ? `${period.completed} 次` : `${period.completed}/${period.expected}`}
                </div>
                {period.rate != null && <div className="font-display text-[10px] text-ink-3">{period.rate}%</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Month calendar */}
      <section className="card p-4 sm:p-5">
        <h2 className="section-title mb-3">本月日历</h2>
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
        <section className="card p-4 sm:p-5">
          <h2 className="section-title mb-2">数值趋势</h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -22, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={habit.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={habit.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.15 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                  domain={yDomain}
                  tickFormatter={(v: number) => (Math.abs(v) >= 10 ? `${Math.round(v)}` : `${Number(v.toFixed(1))}`)}
                />
                <Tooltip
                  formatter={(v) => [`${v} ${habit.unit || ""}`, "数值"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--line))", background: "rgb(var(--card))", fontSize: 12 }}
                  labelStyle={{ color: "rgb(var(--ink-2))" }}
                />
                {target != null && (
                  <ReferenceLine
                    y={target}
                    stroke="rgb(var(--ink-3))"
                    strokeDasharray="4 4"
                    label={{
                      value: `目标 ${target}${habit.unit ? ` ${habit.unit}` : ""}`,
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "rgb(var(--ink-3))",
                    }}
                  />
                )}
                <Area type="monotone" dataKey="value" stroke={habit.color} fill="url(#vgrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* History */}
      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">历史记录</h2>
          {habit.allow_backfill && (
            <button
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
              onClick={() => setBackfillOpen((o) => !o)}
            >
              <Icon name="wrench" className="h-3.5 w-3.5" />
              补签历史
            </button>
          )}
        </div>

        {backfillOpen && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-card-2 p-2">
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

        {stats.values.length === 0 && (
          <EmptyState icon={<Icon name="clipboard" className="h-6 w-6" />} title="还没有记录" desc="开始记录后，这里会显示完整的历史。" />
        )}
        <div>
          {historyGroups.map((g) => (
            <div key={g.month}>
              <div className="mb-1 mt-3 border-b border-line-2 pb-1 text-xs font-medium text-ink-3 first:mt-0">
                {monthLabelCN(g.month)}
              </div>
              <div className="divide-y divide-line-2">
                {g.items.map((v) => (
                  <button
                    key={v.date}
                    className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-line-2"
                    onClick={() => {
                      setEditingRecord(v);
                      setDialogDate(v.date);
                    }}
                  >
                    <span className="font-display text-ink-2">{v.date}</span>
                    <span className="flex items-center gap-2 text-xs">
                      {v.is_backfilled && (
                        <span className="flex items-center gap-1 rounded bg-warning-500/10 px-1.5 py-0.5 text-warning-600 dark:text-warning-500">
                          <Icon name="wrench" className="h-3 w-3" />
                          补签
                        </span>
                      )}
                      <span className={`flex items-center gap-1 ${v.is_completed ? "text-success-600 dark:text-success-500" : "text-ink-3"}`}>
                        {v.is_completed ? (
                          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
                        ) : (
                          <Icon name="circle" className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        {v.value_number != null && ` ${v.value_number}${habit.unit ? ` ${habit.unit}` : ""}`}
                        {v.value_text != null && ` ${v.value_text}`}
                        {v.value_time != null && ` ${v.value_time}`}
                      </span>
                    </span>
                    {v.note && <span className="mt-0.5 block truncate text-xs text-ink-3">“{v.note}”</span>}
                  </button>
                ))}
              </div>
            </div>
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
                  note: editingRecord.note,
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
