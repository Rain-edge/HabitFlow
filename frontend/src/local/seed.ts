// Dev-only demo seeder — triggered by visiting  /?demo=1  (or  ?demo=reset).
// Never imported by the production build path outside main.tsx's DEV guard.
import { localDB, StoredHabit, StoredJournal, StoredRecord, StoredNotificationSettings } from "./db";
import { toISO } from "./habitLogic";

const DAY = 86_400_000;

function iso(d: Date): string {
  return toISO(d);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - n * DAY);
}

export async function seedDemoData(reset: boolean): Promise<boolean> {
  const existing = await localDB.getAll<StoredHabit>("habits");
  if (existing.length > 0 && !reset) return false; // never touch real user data

  for (const s of ["habits", "records", "journal", "achievements", "inbox"] as const) {
    await localDB.clear(s);
  }
  await localDB.put<StoredNotificationSettings>("notification_settings", {
    key: "settings",
    daily_summary_enabled: true,
    daily_summary_time: "22:00",
    habit_reminders_enabled: true,
  });

  const start = daysAgo(90);
  const habits: StoredHabit[] = [
    {
      id: 1, name: "坚持喝水", description: "每天喝够 2000ml", icon: "droplets", color: "#4FA8C9",
      category: "健康", record_type: "number", target_value: 2000, unit: "ml",
      select_options: null, schedule_type: "daily", weekly_target: null, weekly_days: null,
      start_date: iso(start), end_date: null, reminder_time: "09:00", reminder_enabled: true,
      is_active: true, show_on_homepage: true, counts_for_daily: true, allow_backfill: true,
      created_at: iso(start), deleted_at: null,
    },
    {
      id: 2, name: "晨跑", description: "慢跑半小时", icon: "footprints", color: "#18A396",
      category: "健康", record_type: "duration", target_value: 30, unit: "分钟",
      select_options: null, schedule_type: "daily", weekly_target: null, weekly_days: null,
      start_date: iso(start), end_date: null, reminder_time: "07:00", reminder_enabled: true,
      is_active: true, show_on_homepage: true, counts_for_daily: true, allow_backfill: true,
      created_at: iso(start), deleted_at: null,
    },
    {
      id: 3, name: "睡前阅读", description: "放下手机，读几页书", icon: "book-open", color: "#8B7CF6",
      category: "学习", record_type: "duration", target_value: 30, unit: "分钟",
      select_options: null, schedule_type: "weekly_days", weekly_target: null, weekly_days: [0, 1, 2, 3, 4, 5, 6],
      start_date: iso(start), end_date: null, reminder_time: "21:30", reminder_enabled: true,
      is_active: true, show_on_homepage: true, counts_for_daily: true, allow_backfill: true,
      created_at: iso(start), deleted_at: null,
    },
    {
      id: 4, name: "早睡", description: "23 点前睡觉", icon: "moon", color: "#6FA88F",
      category: "作息", record_type: "time", target_value: null, unit: null,
      select_options: null, schedule_type: "daily", weekly_target: null, weekly_days: null,
      start_date: iso(start), end_date: null, reminder_time: "22:30", reminder_enabled: true,
      is_active: true, show_on_homepage: true, counts_for_daily: true, allow_backfill: true,
      created_at: iso(start), deleted_at: null,
    },
    {
      id: 5, name: "冥想", description: "每天十分钟，静下来", icon: "flower", color: "#7C8FA6",
      category: "健康", record_type: "boolean", target_value: null, unit: null,
      select_options: null, schedule_type: "daily", weekly_target: null, weekly_days: null,
      start_date: iso(start), end_date: null, reminder_time: "08:30", reminder_enabled: false,
      is_active: true, show_on_homepage: true, counts_for_daily: true, allow_backfill: true,
      created_at: iso(start), deleted_at: null,
    },
    {
      id: 6, name: "英语单词", description: "每天背 30 个", icon: "target", color: "#E89B5B",
      category: "学习", record_type: "number", target_value: 30, unit: "个",
      select_options: null, schedule_type: "daily", weekly_target: null, weekly_days: null,
      start_date: iso(start), end_date: null, reminder_time: "20:00", reminder_enabled: false,
      is_active: true, show_on_homepage: true, counts_for_daily: true, allow_backfill: true,
      created_at: iso(start), deleted_at: null,
    },
  ];
  for (const h of habits) await localDB.put("habits", h);

  // Records: realistic streaks with a few missed days and backfills.
  let id = 1;
  const rng = (seed: number) => {
    const x = Math.sin(seed * 999 + 7) * 10000;
    return x - Math.floor(x);
  };
  for (let d = 90; d >= 0; d--) {
    const date = iso(daysAgo(d));
    for (const h of habits) {
      const roll = rng(h.id * 1000 + d * 31);
      // skip ~7% of days per habit (missed days), except recent 3 days mostly done
      const missChance = d <= 2 ? 0.05 : 0.08;
      if (roll < missChance) continue;

      const rec: StoredRecord = {
        id: id++,
        habit_id: h.id,
        record_date: date,
        value_number: null,
        value_text: null,
        value_time: null,
        is_completed: true,
        is_backfilled: d <= 3 && roll > 0.97,
        note: null,
        created_at: `${date}T10:00:00`,
        updated_at: `${date}T10:00:00`,
        deleted_at: null,
      };
      if (h.record_type === "number") {
        const base = h.id === 1 ? 1800 : 28;
        const wave = Math.round(Math.sin(d / 6) * 250);
        rec.value_number = Math.max(1200, base + wave + Math.round(rng(h.id + d) * 300));
        rec.is_completed = (rec.value_number ?? 0) >= (h.target_value ?? 1);
      } else if (h.record_type === "duration") {
        rec.value_number = 25 + Math.round(rng(h.id * 7 + d) * 15);
        rec.is_completed = (rec.value_number ?? 0) >= (h.target_value ?? 1);
      } else if (h.record_type === "time") {
        rec.value_time = rng(h.id + d * 3) > 0.3 ? "22:30" : "23:15";
      }
      await localDB.put("records", rec);
    }
  }

  // Journal entries for the last few days.
  const journals: StoredJournal[] = [
    { journal_date: iso(daysAgo(2)), mood: 8, energy: 7, overall: 8, stress: 4, text: "晨跑很舒服，一天都精神。", updated_at: `${iso(daysAgo(2))}T21:00:00` },
    { journal_date: iso(daysAgo(1)), mood: 7, energy: 6, overall: 7, stress: 5, text: "事情有点多，但还是完成了阅读计划。", updated_at: `${iso(daysAgo(1))}T21:30:00` },
    { journal_date: iso(daysAgo(0)), mood: 8, energy: 8, overall: 8, stress: 3, text: "周末的早晨，阳光很好。", updated_at: `${iso(daysAgo(0))}T10:00:00` },
  ];
  for (const j of journals) await localDB.put("journal", j);

  return true;
}
