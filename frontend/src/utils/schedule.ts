import type { Habit } from "../types";

const WEEKDAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

export function scheduleLabel(h: Pick<Habit, "schedule_type" | "weekly_target" | "weekly_days">): string {
  if (h.schedule_type === "daily") return "每天";
  if (h.schedule_type === "weekly_count") return `每周 ${h.weekly_target} 次`;
  const days = h.weekly_days || [];
  if (new Set(days).size === 7) return "每天";
  return `每周${days.map((d) => WEEKDAY_NAMES[d]).join("、")}`;
}
