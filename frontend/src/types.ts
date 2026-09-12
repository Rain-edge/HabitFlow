export interface User {
  id: number;
  email: string;
  username: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export type RecordType = "boolean" | "number" | "duration" | "rating" | "select" | "text" | "time";
export type ScheduleType = "daily" | "weekly_count" | "weekly_days";

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category: string;
  record_type: RecordType;
  target_value: number | null;
  unit: string | null;
  select_options: string[] | null;
  schedule_type: ScheduleType;
  weekly_target: number | null;
  weekly_days: number[] | null;
  start_date: string;
  end_date: string | null;
  reminder_time: string | null;
  reminder_enabled: boolean;
  is_active: boolean;
  show_on_homepage: boolean;
  counts_for_daily: boolean;
  allow_backfill: boolean;
  created_at: string;
  deleted_at: string | null;
}

export interface HabitRecord {
  id: number;
  habit_id: number;
  record_date: string;
  value_number: number | null;
  value_text: string | null;
  value_time: string | null;
  is_completed: boolean;
  is_backfilled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodayItem {
  habit_id: number;
  name: string;
  icon: string;
  color: string;
  record_type: RecordType;
  target_value: number | null;
  unit: string | null;
  schedule_type: ScheduleType;
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
    note: string | null;
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

export interface JournalEntry {
  journal_date: string;
  mood: number | null;
  energy: number | null;
  overall: number | null;
  stress: number | null;
  text: string | null;
  has_entry: boolean;
  updated_at: string | null;
}

export interface HabitStats {
  schedule_type: ScheduleType;
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
    note: string | null;
  }[];
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

export interface CalendarDay {
  date: string;
  status: "full" | "partial" | "none" | "empty" | "future";
  done: number;
  expected: number;
}
