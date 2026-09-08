// Pure habit logic ported from backend/app/core/habit_logic.py
// No storage access — all computed from plain values so it can be tested.

export type RecordType = "boolean" | "number" | "duration" | "rating" | "select" | "text" | "time";
export type ScheduleType = "daily" | "weekly_count" | "weekly_days";

export function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function isRecordCompleted(
  recordType: string,
  opts: {
    target_value?: number | null;
    value_number?: number | null;
    value_text?: string | null;
    value_time?: string | null;
    is_completed?: boolean | null;
  } = {}
): boolean {
  const { target_value, value_number, value_text, value_time, is_completed } = opts;
  if (recordType === "boolean") {
    return is_completed != null ? !!is_completed : true;
  }
  if (recordType === "number" || recordType === "duration") {
    if (value_number == null) return false;
    if (target_value != null) return value_number >= target_value;
    return value_number > 0;
  }
  if (recordType === "rating") {
    if (value_number == null) return false;
    if (target_value != null) return value_number >= target_value;
    return true;
  }
  if (recordType === "select") return !!value_text;
  if (recordType === "text") return !!(value_text && value_text.trim());
  if (recordType === "time") return !!value_time;
  return false;
}

/** Monday-based start of the ISO week containing d. */
export function weekStart(d: Date): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

export function weekStartISO(iso: string): string {
  return toISO(weekStart(toDate(iso)));
}

/** All dates on which a daily / weekly-days habit is expected, up to today. */
export function scheduledDates(
  startDate: string,
  today: string,
  scheduleType: string,
  weeklyDays: number[] = [],
  endDate?: string | null
): string[] {
  if (scheduleType === "weekly_count") return [];
  let cap = toDate(today);
  if (endDate) {
    const e = toDate(endDate);
    if (e < cap) cap = e;
  }
  const start = toDate(startDate);
  if (start > cap) return [];
  const allowed = new Set(weeklyDays);
  const out: string[] = [];
  let d = new Date(start);
  while (d <= cap) {
    if (scheduleType === "daily" || ((d.getDay() + 6) % 7) in allowed) {
      out.push(toISO(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Current + longest streak over an ordered list of scheduled dates. */
export function dailyStreaks(scheduled: string[], completed: Set<string>, today: string): [number, number] {
  if (scheduled.length === 0) return [0, 0];
  const status = scheduled.map((d) => completed.has(d));

  let longest = 0;
  let run = 0;
  for (const ok of status) {
    run = ok ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  let idx = scheduled.length - 1;
  if (scheduled[scheduled.length - 1] === today && !status[status.length - 1]) {
    idx -= 1;
  }
  let current = 0;
  while (idx >= 0 && status[idx]) {
    current += 1;
    idx -= 1;
  }
  return [current, longest];
}

/** Streaks measured in weeks for 'N times per week' habits. */
export function weeklyGoalStreaks(
  startDate: string,
  today: string,
  weeklyTarget: number,
  completedDates: Set<string>,
  endDate?: string | null
): [number, number, number, number] {
  if (weeklyTarget <= 0) return [0, 0, 0, 0];
  let cap = toDate(today);
  if (endDate) {
    const e = toDate(endDate);
    if (e < cap) cap = e;
  }
  const start = toDate(startDate);
  if (start > cap) return [0, 0, 0, 0];

  const first = weekStart(start);
  const last = weekStart(cap);
  const weeks: Date[] = [];
  let w = new Date(first);
  while (w <= last) {
    weeks.push(new Date(w));
    w.setDate(w.getDate() + 7);
  }

  const perWeek = new Map<string, number>();
  for (const d of completedDates) {
    const dd = toDate(d);
    if (dd < start || dd > cap) continue;
    const key = toISO(weekStart(dd));
    perWeek.set(key, (perWeek.get(key) || 0) + 1);
  }

  const met = weeks.map((week) => (perWeek.get(toISO(week)) || 0) >= weeklyTarget);

  let longest = 0;
  let run = 0;
  for (const ok of met) {
    run = ok ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  let idx = weeks.length - 1;
  const currentWeek = weekStart(toDate(today));
  if (weeks[weeks.length - 1].getTime() === currentWeek.getTime() && !met[met.length - 1]) {
    idx -= 1;
  }
  let current = 0;
  while (idx >= 0 && met[idx]) {
    current += 1;
    idx -= 1;
  }

  return [current, longest, weeks.length, met.filter(Boolean).length];
}

/** Completion counts for a date range (inclusive). */
export function periodStats(
  scheduled: string[],
  completed: Set<string>,
  start: string,
  end: string
): { expected: number; completed: number; rate: number } {
  const schedIn = scheduled.filter((d) => d >= start && d <= end);
  const doneIn = schedIn.filter((d) => completed.has(d));
  return {
    expected: schedIn.length,
    completed: doneIn.length,
    rate: schedIn.length ? Math.round((doneIn.length / schedIn.length) * 1000) / 10 : 0,
  };
}

/** Calendar grid: 6 rows x 7 cols starting Monday, nulls pad the edges. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
