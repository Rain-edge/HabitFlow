// Local statistics service — replaces backend modules/statistics + achievements.
import { localDB, StoredHabit, StoredRecord, StoredAchievement } from "./db";
import {
  dailyStreaks,
  periodStats,
  scheduledDates,
  toDate,
  toISO,
  weekStartISO,
  weeklyGoalStreaks,
} from "./habitLogic";

export function todayISO(): string {
  return toISO(new Date());
}

export function weekdayCN(iso: string): string {
  const d = toDate(iso);
  const names = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  return names[(d.getDay() + 6) % 7];
}

export function formatCN(iso: string): string {
  const d = toDate(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function shortCN(iso: string): string {
  const d = toDate(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ---------- record helpers ----------

export async function completedDatesFor(habitId: number): Promise<Set<string>> {
  const records = await localDB.recordsForHabit(habitId);
  const out = new Set<string>();
  for (const r of records) {
    if (r.is_completed) out.add(r.record_date);
  }
  return out;
}

export async function allCompletedDatesMap(habitIds: number[]): Promise<Map<number, Set<string>>> {
  const records = await localDB.getAll<StoredRecord>("records");
  const out = new Map<number, Set<string>>();
  for (const h of habitIds) out.set(h, new Set());
  for (const r of records) {
    if (r.deleted_at != null || !r.is_completed) continue;
    const s = out.get(r.habit_id);
    if (s) s.add(r.record_date);
  }
  return out;
}

export async function recordCounts(habitId?: number): Promise<[number, number, number]> {
  const records = await localDB.getAll<StoredRecord>("records");
  const rows = habitId != null ? records.filter((r) => r.habit_id === habitId) : records;
  const completed = rows.filter((r) => r.deleted_at == null && r.is_completed);
  const normal = completed.filter((r) => !r.is_backfilled).length;
  return [completed.length, normal, completed.length - normal];
}

// ---------- per-habit stats ----------

export interface HabitStats {
  schedule_type: string;
  streak_unit: "day" | "week";
  current_streak: number;
  longest_streak: number;
  expected_total: number;
  completion_rate: number;
  total_completed: number;
  normal_completed: number;
  backfilled_completed: number;
  last_7_days: { expected: number | null; completed: number; rate: number | null };
  last_30_days: { expected: number | null; completed: number; rate: number | null };
  this_week: { expected: number | null; completed: number; rate: number | null };
  this_month: { expected: number | null; completed: number; rate: number | null };
  weekly: { target: number; weeks_total: number; weeks_met: number; this_week_done: number } | null;
  completed_dates: string[];
  values: {
    id: number;
    date: string;
    value_number: number | null;
    value_text: string | null;
    value_time: string | null;
    is_completed: boolean;
    is_backfilled: boolean;
  }[];
}

export function computeHabitStats(habit: StoredHabit, completed: Set<string>, today: string): Omit<HabitStats, "values"> {
  const weeklyTarget = habit.weekly_target ?? 1;
  if (habit.schedule_type === "daily" || habit.schedule_type === "weekly_days") {
    const scheduled = scheduledDates(habit.start_date, today, habit.schedule_type, habit.weekly_days || [], habit.end_date);
    const [current, longest] = dailyStreaks(scheduled, completed, today);
    const expectedTotal = scheduled.length;
    const streakUnit: "day" = "day";

    const last7 = periodStats(scheduled, completed, addDaysISO(today, -6), today);
    const last30 = periodStats(scheduled, completed, addDaysISO(today, -29), today);
    const thisWeek = periodStats(scheduled, completed, weekStartISO(today), today);
    const monthStart = toISO(new Date(toDate(today).getFullYear(), toDate(today).getMonth(), 1));
    const thisMonth = periodStats(scheduled, completed, monthStart, today);

    const completionRate = expectedTotal ? Math.round(Math.min(100, (completed.size / expectedTotal) * 100) * 10) / 10 : 0;

    return {
      schedule_type: habit.schedule_type,
      streak_unit: streakUnit,
      current_streak: current,
      longest_streak: longest,
      expected_total: expectedTotal,
      completion_rate: completionRate,
      last_7_days: last7,
      last_30_days: last30,
      this_week: thisWeek,
      this_month: thisMonth,
      weekly: null,
    } as Omit<HabitStats, "values">;
  }

  // weekly_count
  const [current, longest, weeksTotal, weeksMet] = weeklyGoalStreaks(
    habit.start_date,
    today,
    weeklyTarget,
    completed,
    habit.end_date
  );
  const streakUnit: "week" = "week";
  const expectedTotal = weeksTotal * weeklyTarget;

  const sessionsBetween = (start: string, end: string) => {
    let n = 0;
    for (const d of completed) if (d >= start && d <= end) n++;
    return n;
  };
  const last7: { expected: number | null; completed: number; rate: number | null } = {
    expected: weeklyTarget,
    completed: sessionsBetween(addDaysISO(today, -6), today),
    rate: null,
  };
  const last30: { expected: number | null; completed: number; rate: number | null } = {
    expected: null,
    completed: sessionsBetween(addDaysISO(today, -29), today),
    rate: null,
  };
  const thisWeek: { expected: number | null; completed: number; rate: number | null } = {
    expected: weeklyTarget,
    completed: sessionsBetween(weekStartISO(today), today),
    rate: null,
  };
  const monthStart = toISO(new Date(toDate(today).getFullYear(), toDate(today).getMonth(), 1));
  const thisMonth: { expected: number | null; completed: number; rate: number | null } = {
    expected: null,
    completed: sessionsBetween(monthStart, today),
    rate: null,
  };
  for (const p of [last7, last30, thisWeek, thisMonth]) {
    p.rate = p.expected ? Math.round(Math.min(100, (p.completed / p.expected) * 100) * 10) / 10 : null;
  }
  const weekly = {
    target: weeklyTarget,
    weeks_total: weeksTotal,
    weeks_met: weeksMet,
    this_week_done: thisWeek.completed,
  };
  const completionRate = expectedTotal ? Math.round(Math.min(100, (completed.size / expectedTotal) * 100) * 10) / 10 : 0;

  return {
    schedule_type: habit.schedule_type,
    streak_unit: streakUnit,
    current_streak: current,
    longest_streak: longest,
    expected_total: expectedTotal,
    completion_rate: completionRate,
    last_7_days: last7,
    last_30_days: last30,
    this_week: thisWeek,
    this_month: thisMonth,
    weekly,
  } as Omit<HabitStats, "values">;
}

function addDaysISO(iso: string, days: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export async function getHabitStats(habit: StoredHabit, today = todayISO()): Promise<HabitStats> {
  const completed = await completedDatesFor(habit.id);
  const stats = computeHabitStats(habit, completed, today);
  const [total, normal, backfilled] = await recordCounts(habit.id);
  const records = (await localDB.recordsForHabit(habit.id)).sort((a, b) => a.record_date.localeCompare(b.record_date));
  return {
    ...stats,
    total_completed: total,
    normal_completed: normal,
    backfilled_completed: backfilled,
    completed_dates: [...completed].sort(),
    values: records.map((r) => ({
      id: r.id,
      date: r.record_date,
      value_number: r.value_number,
      value_text: r.value_text,
      value_time: r.value_time,
      is_completed: r.is_completed,
      is_backfilled: r.is_backfilled,
    })),
  };
}

// ---------- dashboard "today" ----------

export interface TodayItem {
  habit_id: number;
  name: string;
  icon: string;
  color: string;
  record_type: string;
  target_value: number | null;
  unit: string | null;
  schedule_type: string;
  scheduled_today: boolean;
  done_today: boolean;
  current_streak: number;
  streak_unit: "day" | "week";
  weekly: { target: number; weeks_total: number; weeks_met: number; this_week_done: number } | null;
  show_on_homepage: boolean;
  record: {
    id: number;
    value_number: number | null;
    value_text: string | null;
    value_time: string | null;
    is_backfilled: boolean;
  } | null;
}

export interface TodayDashboard {
  date: string;
  weekday: number;
  completion_rate: number;
  scheduled_count: number;
  done_count: number;
  items: TodayItem[];
  journal: {
    mood: number | null;
    energy: number | null;
    overall: number | null;
    text: string | null;
    has_entry: boolean;
  };
}

function isScheduledOn(habit: StoredHabit, d: string): boolean {
  if (d < habit.start_date || (habit.end_date && d > habit.end_date)) return false;
  if (habit.schedule_type === "daily") return true;
  if (habit.schedule_type === "weekly_days") {
    return (toDate(d).getDay() + 6) % 7 in (habit.weekly_days || []);
  }
  return false;
}

export async function todayDashboard(today = todayISO()): Promise<TodayDashboard> {
  const [allHabits, recordsToday] = await Promise.all([
    localDB.getAll<StoredHabit>("habits"),
    localDB.recordsOnDate(today),
  ]);
  const habits = allHabits.filter((h) => !h.deleted_at && h.is_active);
  const completedMap = await allCompletedDatesMap(habits.map((h) => h.id));
  const recordMap = new Map<number, StoredRecord>();
  for (const r of recordsToday) recordMap.set(r.habit_id, r);

  let scheduledCount = 0;
  let doneCount = 0;
  const items: TodayItem[] = [];

  for (const habit of habits) {
    const completed = completedMap.get(habit.id) || new Set<string>();
    const todayDone = completed.has(today);
    const rec = recordMap.get(habit.id);

    if (habit.schedule_type === "weekly_count") {
      const stats = computeHabitStats(habit, completed, today);
      items.push({
        habit_id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        record_type: habit.record_type,
        target_value: habit.target_value,
        unit: habit.unit,
        schedule_type: habit.schedule_type,
        scheduled_today: false,
        done_today: todayDone,
        current_streak: stats.weekly?.this_week_done ?? 0,
        streak_unit: "week",
        weekly: stats.weekly,
        show_on_homepage: habit.show_on_homepage,
        record: rec
          ? { id: rec.id, value_number: rec.value_number, value_text: rec.value_text, value_time: rec.value_time, is_backfilled: rec.is_backfilled }
          : null,
      });
      continue;
    }

    const scheduled = isScheduledOn(habit, today);
    if (scheduled && habit.counts_for_daily) {
      scheduledCount += 1;
      if (todayDone) doneCount += 1;
    }
    const [current] = dailyStreaks(
      scheduledDates(habit.start_date, today, habit.schedule_type, habit.weekly_days || [], habit.end_date),
      completed,
      today
    );
    items.push({
      habit_id: habit.id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      record_type: habit.record_type,
      target_value: habit.target_value,
      unit: habit.unit,
      schedule_type: habit.schedule_type,
      scheduled_today: scheduled,
      done_today: todayDone,
      current_streak: current,
      streak_unit: "day",
      weekly: null,
      show_on_homepage: habit.show_on_homepage,
      record: rec
        ? { id: rec.id, value_number: rec.value_number, value_text: rec.value_text, value_time: rec.value_time, is_backfilled: rec.is_backfilled }
        : null,
    });
  }

  const journal = await localDB.get<StoredJournalLike>("journal", today);
  return {
    date: today,
    weekday: (toDate(today).getDay() + 6) % 7,
    completion_rate: scheduledCount ? Math.round((doneCount / scheduledCount) * 1000) / 10 : 100,
    scheduled_count: scheduledCount,
    done_count: doneCount,
    items,
    journal: {
      mood: journal?.mood ?? null,
      energy: journal?.energy ?? null,
      overall: journal?.overall ?? null,
      text: journal?.text ?? null,
      has_entry: !!journal,
    },
  };
}

interface StoredJournalLike {
  journal_date: string;
  mood: number | null;
  energy: number | null;
  overall: number | null;
  stress: number | null;
  text: string | null;
  updated_at: string | null;
}

// ---------- overview / trend / calendar ----------

export interface Overview {
  range: string;
  start: string;
  end: string;
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

const RANGE_DAYS: Record<string, number> = { today: 1, week: 7, month: 30, "30d": 30, "90d": 90, year: 365 };

export async function overview(range: string, today = todayISO()): Promise<Overview> {
  const habits = (await localDB.getAll<StoredHabit>("habits")).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const completedMap = await allCompletedDatesMap(habits.map((h) => h.id));

  let start: string;
  if (range === "all") {
    start = habits.length ? habits.reduce((m, h) => (h.start_date < m ? h.start_date : m), habits[0].start_date) : today;
  } else {
    const days = RANGE_DAYS[range] || 30;
    start = addDaysISO(today, -(days - 1));
  }

  let totalExpected = 0;
  let totalCompleted = 0;
  let weeklyMet = 0;
  let weeklyTotal = 0;
  const perHabit: Overview["habits"] = [];

  for (const habit of habits) {
    const completed = completedMap.get(habit.id) || new Set<string>();
    const stats = computeHabitStats(habit, completed, today);
    if (habit.schedule_type === "weekly_count") {
      if (stats.weekly) {
        weeklyTotal += stats.weekly.weeks_total;
        weeklyMet += stats.weekly.weeks_met;
      }
    } else {
      const p = periodStats(
        scheduledDates(habit.start_date, today, habit.schedule_type, habit.weekly_days || [], habit.end_date),
        completed,
        start,
        today
      );
      totalExpected += p.expected;
      totalCompleted += p.completed;
    }
    perHabit.push({
      habit_id: habit.id,
      name: habit.name,
      icon: habit.icon,
      schedule_type: habit.schedule_type,
      current_streak: stats.current_streak,
      longest_streak: stats.longest_streak,
      streak_unit: stats.streak_unit,
      completion_rate: stats.completion_rate,
      deleted: habit.deleted_at != null,
    });
  }

  const [totalRecords, normalRecords, backfilledRecords] = await recordCounts();
  const allRecords = await localDB.getAll<StoredRecord>("records");
  const recordDays = new Set(allRecords.filter((r) => r.deleted_at == null && r.is_completed).map((r) => r.record_date)).size;

  const candidates = perHabit
    .map((p, i) => ({ habit: habits[i], p }))
    .filter((x) => !x.habit.deleted_at && x.habit.schedule_type !== "weekly_count");
  let best: Overview["most_stable"] = null;
  let worst: Overview["most_fragile"] = null;
  if (candidates.length) {
    const sorted = [...candidates].sort((a, b) => b.p.completion_rate - a.p.completion_rate);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    best = { name: top.habit.name, icon: top.habit.icon, rate: top.p.completion_rate };
    worst = { name: bottom.habit.name, icon: bottom.habit.icon, rate: bottom.p.completion_rate };
  }

  return {
    range,
    start,
    end: today,
    completion_rate: totalExpected ? Math.round((totalCompleted / totalExpected) * 1000) / 10 : null,
    expected: totalExpected,
    completed: totalCompleted,
    weekly_goal: weeklyTotal ? { met: weeklyMet, total: weeklyTotal } : null,
    total_records: totalRecords,
    normal_records: normalRecords,
    backfilled_records: backfilledRecords,
    record_days: recordDays,
    most_stable: best,
    most_fragile: worst,
    habits: perHabit,
    active_habit_count: habits.filter((h) => !h.deleted_at).length,
  };
}

export async function trend(days: number, today = todayISO()): Promise<{ series: { date: string; expected: number; completed: number; rate: number | null }[] }> {
  const habits = (await localDB.getAll<StoredHabit>("habits")).filter((h) => !h.deleted_at && h.schedule_type !== "weekly_count");
  const completedMap = await allCompletedDatesMap(habits.map((h) => h.id));
  const start = addDaysISO(today, -(days - 1));

  const daily = (d: string) => {
    let expected = 0;
    let done = 0;
    for (const habit of habits) {
      if (habit.counts_for_daily && isScheduledOn(habit, d)) {
        expected += 1;
        if ((completedMap.get(habit.id) || new Set()).has(d)) done += 1;
      }
    }
    return { expected, done, rate: expected ? Math.round((done / expected) * 1000) / 10 : null };
  };

  const series: { date: string; expected: number; completed: number; rate: number | null }[] = [];

  if (days > 90) {
    // Aggregate by week to keep the chart readable for long ranges.
    let bucket: { date: string; expected: number; completed: number; count: number } | null = null;
    let d = start;
    while (d <= today) {
      const { expected, done } = daily(d);
      if (!bucket) bucket = { date: d, expected: 0, completed: 0, count: 0 };
      bucket.expected += expected;
      bucket.completed += done;
      bucket.count += 1;
      if (bucket.count === 7 || d === today) {
        series.push({
          date: bucket.date,
          expected: bucket.expected,
          completed: bucket.completed,
          rate: bucket.expected ? Math.round((bucket.completed / bucket.expected) * 1000) / 10 : null,
        });
        bucket = null;
      }
      d = addDaysISO(d, 1);
    }
  } else {
    let d = start;
    while (d <= today) {
      const { expected, done, rate } = daily(d);
      series.push({ date: d, expected, completed: done, rate });
      d = addDaysISO(d, 1);
    }
  }
  return { series };
}

export async function calendar(year: number, month: number, today = todayISO()): Promise<{ year: number; month: number; days: { date: string; status: string; done: number; expected: number }[] }> {
  const habits = (await localDB.getAll<StoredHabit>("habits")).filter((h) => !h.deleted_at && h.schedule_type !== "weekly_count");
  const completedMap = await allCompletedDatesMap(habits.map((h) => h.id));
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: { date: string; status: string; done: number; expected: number }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = toISO(new Date(year, month - 1, day));
    let expected = 0;
    let done = 0;
    for (const habit of habits) {
      if (habit.counts_for_daily && isScheduledOn(habit, d)) {
        expected += 1;
        if ((completedMap.get(habit.id) || new Set()).has(d)) done += 1;
      }
    }
    let status: string;
    if (d > today) status = "future";
    else if (expected === 0) status = "empty";
    else if (done === expected) status = "full";
    else if (done === 0) status = "none";
    else status = "partial";
    days.push({ date: d, status, done, expected });
  }
  return { year, month, days };
}

// ---------- achievements ----------

const ACHIEVEMENT_CATALOG: { code: string; name: string; description: string; icon: string; category: string; threshold: number }[] = [
  { code: "streak_3", name: "初次坚持", description: "连续坚持 3 天", icon: "🌱", category: "streak", threshold: 3 },
  { code: "streak_7", name: "一周达人", description: "连续坚持 7 天", icon: "🔥", category: "streak", threshold: 7 },
  { code: "streak_14", name: "两周不断", description: "连续坚持 14 天", icon: "⚡", category: "streak", threshold: 14 },
  { code: "streak_30", name: "月度坚持", description: "连续坚持 30 天", icon: "🏅", category: "streak", threshold: 30 },
  { code: "streak_50", name: "五十日之约", description: "连续坚持 50 天", icon: "🎖️", category: "streak", threshold: 50 },
  { code: "streak_100", name: "百日坚持", description: "连续坚持 100 天", icon: "🏆", category: "streak", threshold: 100 },
  { code: "total_10", name: "小有所成", description: "单个习惯累计完成 10 次", icon: "✨", category: "total", threshold: 10 },
  { code: "total_50", name: "积少成多", description: "单个习惯累计完成 50 次", icon: "💪", category: "total", threshold: 50 },
  { code: "total_100", name: "百次里程碑", description: "单个习惯累计完成 100 次", icon: "🌟", category: "total", threshold: 100 },
  { code: "total_365", name: "一年之约", description: "单个习惯累计完成 365 次", icon: "👑", category: "total", threshold: 365 },
  { code: "full_month", name: "圆满一月", description: "一个自然月内全部应完成日都完成", icon: "🗓️", category: "calendar", threshold: 1 },
  { code: "full_quarter", name: "圆满一季", description: "连续三个自然月全部应完成日都完成", icon: "🎯", category: "calendar", threshold: 3 },
];

function monthsBetween(start: string, end: string): [string, string][] {
  const out: [string, string][] = [];
  const s = toDate(start);
  const e = toDate(end);
  let y = s.getFullYear();
  let m = s.getMonth() + 1;
  while (toISO(new Date(y, m - 1, 1)) <= end) {
    const first = toISO(new Date(y, m - 1, 1));
    const last = toISO(new Date(y, m, 0));
    out.push([first, last]);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (y > e.getFullYear() + 1) break;
  }
  return out;
}

function fullMonths(scheduled: string[], completed: Set<string>, today: string): number {
  if (!scheduled.length) return 0;
  const last = scheduled[scheduled.length - 1] < today ? scheduled[scheduled.length - 1] : today;
  const months = monthsBetween(scheduled[0], last);
  const schedSet = new Set(scheduled);
  let best = 0;
  let run = 0;
  for (const [first, lastD] of months) {
    if (lastD > today) break;
    const inMonth = [...schedSet].filter((d) => d >= first && d <= lastD);
    if (!inMonth.length) continue;
    if (inMonth.every((d) => completed.has(d))) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export interface AchievementView {
  code: string;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  threshold: number;
  unlocked: boolean;
  unlocked_count: number;
  unlocked_details: { habit_id: number | null; habit_name: string | null; unlocked_at: string }[];
}

export async function listAchievements(): Promise<AchievementView[]> {
  const unlocked = await localDB.getAll<StoredAchievement>("achievements");
  const habits = await localDB.getAll<StoredHabit>("habits");
  const nameById = new Map(habits.map((h) => [h.id, h.name]));
  return ACHIEVEMENT_CATALOG.map((a) => {
    const mine = unlocked.filter((u) => u.code === a.code);
    return {
      code: a.code,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      threshold: a.threshold,
      unlocked: mine.length > 0,
      unlocked_count: mine.length,
      unlocked_details: mine.slice(0, 10).map((u) => ({
        habit_id: u.habit_id,
        habit_name: u.habit_id != null ? nameById.get(u.habit_id) ?? null : null,
        unlocked_at: u.unlocked_at,
      })),
    };
  });
}

export async function evaluateAchievements(): Promise<string[]> {
  const habits = await localDB.getAll<StoredHabit>("habits");
  const unlocked = await localDB.getAll<StoredAchievement>("achievements");
  const existing = new Set(unlocked.map((u) => `${u.code}:${u.habit_id}`));
  const today = todayISO();
  const newly: string[] = [];

  for (const habit of habits) {
    const completed = await completedDatesFor(habit.id);
    const stats = computeHabitStats(habit, completed, today);
    const [total] = await recordCounts(habit.id);

    const candidates: { code: string; habitId: number }[] = [];
    for (const a of ACHIEVEMENT_CATALOG) {
      if (a.category === "streak" && stats.streak_unit === "day" && stats.longest_streak >= a.threshold) {
        candidates.push({ code: a.code, habitId: habit.id });
      } else if (a.category === "total" && total >= a.threshold) {
        candidates.push({ code: a.code, habitId: habit.id });
      }
    }
    if (habit.schedule_type !== "weekly_count") {
      const scheduled = scheduledDates(habit.start_date, today, habit.schedule_type, habit.weekly_days || [], habit.end_date);
      const consecutive = fullMonths(scheduled, completed, today);
      if (consecutive >= 1) candidates.push({ code: "full_month", habitId: habit.id });
      if (consecutive >= 3) candidates.push({ code: "full_quarter", habitId: habit.id });
    }

    for (const c of candidates) {
      const key = `${c.code}:${c.habitId}`;
      if (existing.has(key)) continue;
      existing.add(key);
      const nextId = await localDB.nextId("achievements");
      await localDB.put<StoredAchievement>("achievements", {
        id: nextId,
        code: c.code,
        habit_id: c.habitId,
        habit_name: habit.name,
        unlocked_at: new Date().toISOString(),
      });
      newly.push(`${c.code}:${habit.name}`);
    }
  }
  return newly;
}
