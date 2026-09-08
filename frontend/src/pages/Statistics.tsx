import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import HabitIcon from "../components/HabitIcon";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import { toast } from "../components/Layout";
import { StatCard } from "../components/ui";
import type { AchievementView } from "../types";
import { shortCN } from "../utils/date";

const RANGES = [
  { key: "today", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "30d", label: "30 天" },
  { key: "90d", label: "90 天" },
  { key: "year", label: "本年" },
  { key: "all", label: "全部" },
];

const TREND_DAYS: Record<string, number> = { today: 1, week: 7, month: 30, "30d": 30, "90d": 90, year: 365, all: 365 };

interface Overview {
  range: string;
  completion_rate: number | null;
  expected: number;
  completed: number;
  weekly_goal: { met: number; total: number } | null;
  total_records: number;
  normal_records: number;
  backfilled_records: number;
  record_days: number;
  most_stable: { name: string; icon: string; rate: number } | null;
  most_fragile: { name: string; icon: string; rate: number } | null;
  habits: {
    habit_id: number;
    name: string;
    icon: string;
    schedule_type: string;
    current_streak: number;
    longest_streak: number;
    streak_unit: string;
    completion_rate: number;
    deleted: boolean;
  }[];
  active_habit_count: number;
}

interface Trend {
  series: { date: string; expected: number; completed: number; rate: number | null }[];
}

export default function Statistics() {
  const [range, setRange] = useState("30d");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<Trend | null>(null);
  const [achievements, setAchievements] = useState<AchievementView[]>([]);

  const load = useCallback(async () => {
    const [o, t, a] = await Promise.all([
      api.get<Overview>(`/statistics/overview?range=${range}`),
      api.get<Trend>(`/statistics/trend?days=${TREND_DAYS[range] ?? 30}`),
      api.get<AchievementView[]>("/achievements"),
    ]);
    setOverview(o);
    setTrend(t);
    setAchievements(a);
  }, [range]);

  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, [load]);

  if (!overview) return <div className="py-20 text-center text-sm text-ink-3">加载中…</div>;

  const trendData = trend?.series.map((s) => ({
    date: shortCN(s.date),
    rate: s.rate ?? 0,
  }));

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">统计</h1>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                range === r.key
                  ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300"
                  : "text-ink-2 hover:bg-line-2"
              }`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="完成率"
          value={overview.completion_rate != null ? `${overview.completion_rate}%` : "—"}
          sub={`${overview.completed}/${overview.expected}`}
          accent="brand"
        />
        <StatCard
          label="累计完成"
          value={`${overview.total_records} 次`}
          sub={`正常 ${overview.normal_records} · 补签 ${overview.backfilled_records}`}
        />
        <StatCard label="记录天数" value={`${overview.record_days} 天`} sub="有打卡记录的日子" />
        <StatCard
          label="每周目标"
          value={overview.weekly_goal ? `${overview.weekly_goal.met}/${overview.weekly_goal.total}` : "—"}
          sub="达标周数"
        />
      </div>

      {/* Stable / fragile */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3.5 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <Icon name="shield-check" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] text-ink-3">最稳定的习惯</div>
            <div className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
              {overview.most_stable ? (
                <>
                  <HabitIcon icon={overview.most_stable.icon} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{overview.most_stable.name} · {overview.most_stable.rate}%</span>
                </>
              ) : (
                "暂无数据"
              )}
            </div>
          </div>
        </div>
        <div className="card flex items-center gap-3.5 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-500/10 text-warning-600 dark:text-warning-500">
            <Icon name="alert" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] text-ink-3">最容易中断的习惯</div>
            <div className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
              {overview.most_fragile ? (
                <>
                  <HabitIcon icon={overview.most_fragile.icon} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{overview.most_fragile.name} · {overview.most_fragile.rate}%</span>
                </>
              ) : (
                "暂无数据"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Daily trend */}
      {trendData && trendData.length > 0 && (
        <section className="card card-pad">
          <h2 className="section-title mb-3">每日完成率趋势</h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ left: -22, right: 4, top: 6 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.1} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.15 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, "完成率"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--line))", background: "rgb(var(--card))", fontSize: 12 }}
                  labelStyle={{ color: "rgb(var(--ink-2))" }}
                />
                <Bar dataKey="rate" fill="#18A396" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Per habit table */}
      <section className="card overflow-x-auto p-4 sm:p-5">
        <h2 className="section-title mb-3">各习惯情况</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] text-ink-3">
              <th className="pb-2 font-normal">习惯</th>
              <th className="pb-2 font-normal">当前连续</th>
              <th className="pb-2 font-normal">历史最长</th>
              <th className="pb-2 font-normal">完成率</th>
            </tr>
          </thead>
          <tbody>
            {overview.habits.map((h) => (
              <tr key={h.habit_id} className={`border-t border-line-2 ${h.deleted ? "opacity-40" : ""}`}>
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    <HabitIcon icon={h.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{h.name}</span>
                    {h.deleted && <span className="shrink-0 text-[10px] text-ink-3">（已删除）</span>}
                  </span>
                </td>
                <td className="py-2.5 font-display text-flame-500">
                  {h.current_streak} {h.streak_unit === "week" ? "周" : "天"}
                </td>
                <td className="py-2.5 font-display">
                  {h.longest_streak} {h.streak_unit === "week" ? "周" : "天"}
                </td>
                <td className="py-2.5 font-display">{h.schedule_type === "weekly_count" ? "—" : `${h.completion_rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Achievements */}
      <section className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">成就</h2>
          <span className="caption num">
            {unlockedCount}/{achievements.length} 已解锁
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {achievements.map((a) => (
            <div
              key={a.code}
              className={`rounded-lg border p-3 transition ${
                a.unlocked ? "border-brand-200 bg-brand-500/10" : "border-line-2 opacity-50"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  a.unlocked ? "bg-brand-500/15 text-brand-600 dark:text-brand-300" : "bg-line-2 text-ink-3"
                }`}
              >
                <Icon name={a.icon as IconName} className="h-[18px] w-[18px]" />
              </span>
              <div className="mt-2 text-sm font-medium text-ink">{a.name}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{a.description}</div>
              {a.unlocked && (
                <div className="mt-1.5 text-[10px] text-brand-600 dark:text-brand-300">
                  已解锁 ×{a.unlocked_count}
                  {a.unlocked_details[0]?.habit_name && ` · ${a.unlocked_details[0].habit_name}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
