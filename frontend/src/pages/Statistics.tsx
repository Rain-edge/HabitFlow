import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { toast } from "../components/Layout";
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
      <div className="flex items-center justify-between">
        <h1 className="page-title">统计</h1>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={`rounded-lg px-2.5 py-1 text-xs ${
                range === r.key ? "bg-brand-600 text-white" : "bg-card text-ink-2 hover:bg-line-2"
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
        <div className="card card-pad text-center">
          <div className="text-[11px] text-ink-3">完成率</div>
          <div className="num mt-1 text-xl font-bold text-ink">
            {overview.completion_rate != null ? `${overview.completion_rate}%` : "—"}
          </div>
          <div className="text-[10px] text-ink-3">{overview.completed}/{overview.expected}</div>
        </div>
        <div className="card card-pad text-center">
          <div className="text-[11px] text-ink-3">累计完成</div>
          <div className="num mt-1 text-xl font-bold text-ink">{overview.total_records} 次</div>
          <div className="text-[10px] text-ink-3">
            正常 {overview.normal_records} · 补签 {overview.backfilled_records}
          </div>
        </div>
        <div className="card card-pad text-center">
          <div className="text-[11px] text-ink-3">记录天数</div>
          <div className="num mt-1 text-xl font-bold text-ink">{overview.record_days} 天</div>
        </div>
        <div className="card card-pad text-center">
          <div className="text-[11px] text-ink-3">每周目标</div>
          <div className="num mt-1 text-xl font-bold text-ink">
            {overview.weekly_goal ? `${overview.weekly_goal.met}/${overview.weekly_goal.total}` : "—"}
          </div>
          <div className="text-[10px] text-ink-3">达标周数</div>
        </div>
      </div>

      {/* Stable / fragile */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3 p-4">
          <span className="text-2xl">🪨</span>
          <div>
            <div className="text-[11px] text-ink-3">最稳定的习惯</div>
            <div className="text-sm font-medium text-ink">
              {overview.most_stable
                ? `${overview.most_stable.icon} ${overview.most_stable.name} · ${overview.most_stable.rate}%`
                : "暂无数据"}
            </div>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-[11px] text-ink-3">最容易中断的习惯</div>
            <div className="text-sm font-medium text-ink">
              {overview.most_fragile
                ? `${overview.most_fragile.icon} ${overview.most_fragile.name} · ${overview.most_fragile.rate}%`
                : "暂无数据"}
            </div>
          </div>
        </div>
      </div>

      {/* Daily trend */}
      {trendData && trendData.length > 0 && (
        <section className="card card-pad">
          <h2 className="mb-2 text-sm font-semibold text-ink">每日完成率趋势</h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ left: -22, right: 4, top: 6 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8E6" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9AA6A1" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9AA6A1" }} />
                <Tooltip formatter={(v) => [`${v}%`, "完成率"]} />
                <Bar dataKey="rate" fill="#18A396" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Per habit table */}
      <section className="card overflow-x-auto p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">各习惯情况</h2>
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
                <td className="py-2">
                  {h.icon} {h.name}
                  {h.deleted && <span className="ml-1 text-[10px] text-ink-3">（已删除）</span>}
                </td>
                <td className="py-2 text-flame-500">
                  {h.current_streak} {h.streak_unit === "week" ? "周" : "天"}
                </td>
                <td className="py-2">{h.longest_streak} {h.streak_unit === "week" ? "周" : "天"}</td>
                <td className="py-2">{h.schedule_type === "weekly_count" ? "—" : `${h.completion_rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Achievements */}
      <section className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">成就</h2>
          <span className="text-xs text-ink-3">
            {unlockedCount}/{achievements.length} 已解锁
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {achievements.map((a) => (
            <div
              key={a.code}
              className={`rounded-xl border p-3 ${a.unlocked ? "border-brand-200 bg-brand-500/10" : "border-line-2 opacity-50"}`}
            >
              <div className="text-xl">{a.icon}</div>
              <div className="mt-1 text-sm font-medium text-ink">{a.name}</div>
              <div className="text-[11px] text-ink-3">{a.description}</div>
              {a.unlocked && (
                <div className="mt-1 text-[10px] text-brand-600">
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
