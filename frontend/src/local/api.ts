// Local "API" facade — replaces backend/api/client.ts.
// All pages keep their existing call shape (api.get/post/put/delete) but now hit IndexedDB.
import { localDB, StoredHabit, StoredRecord, StoredJournal, StoredNotificationSettings, StoredInboxItem, StoredTransaction, StoredCategory, TxType } from "./db";
import { evaluateAchievements, todayISO } from "./stats";
import { isRecordCompleted } from "./habitLogic";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function notFound(detail = "未找到"): never {
  throw new ApiError(404, detail);
}

/** Re-run achievement evaluation after a record change (fire-and-forget, never blocks). */
function reevaluateAchievements(): void {
  void evaluateAchievements().catch(() => {
    /* ignore — evaluation failures must never break recording */
  });
}

// ---------- habits ----------

async function habitById(id: number): Promise<StoredHabit> {
  const h = await localDB.get<StoredHabit>("habits", id);
  if (!h) notFound("习惯不存在");
  return h as StoredHabit;
}

export const habitApi = {
  async list(includeDeleted = false): Promise<StoredHabit[]> {
    const all = await localDB.getAll<StoredHabit>("habits");
    return all
      .filter((h) => (includeDeleted ? true : h.deleted_at == null))
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  },
  async get(id: number): Promise<StoredHabit> {
    return habitById(id);
  },
  async create(data: Omit<StoredHabit, "id" | "created_at" | "deleted_at">): Promise<StoredHabit> {
    const id = await localDB.nextId("habits");
    const habit: StoredHabit = {
      ...data,
      id,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    await localDB.put("habits", habit);
    return habit;
  },
  async update(id: number, patch: Partial<StoredHabit>): Promise<StoredHabit> {
    const habit = await habitById(id);
    const updated = { ...habit, ...patch, id };
    await localDB.put("habits", updated);
    return updated;
  },
  async remove(id: number): Promise<void> {
    const habit = await habitById(id);
    habit.deleted_at = new Date().toISOString();
    await localDB.put("habits", habit);
  },
  async restore(id: number): Promise<StoredHabit> {
    const habit = await habitById(id);
    habit.deleted_at = null;
    await localDB.put("habits", habit);
    return habit;
  },
};

// ---------- records ----------

export interface RecordInput {
  habit_id: number;
  record_date: string;
  value_number?: number | null;
  value_text?: string | null;
  value_time?: string | null;
  is_completed?: boolean;
  is_backfilled?: boolean;
  note?: string | null;
}

export const recordApi = {
  async list(params: { on_date?: string }): Promise<StoredRecord[]> {
    if (params.on_date) return localDB.recordsOnDate(params.on_date);
    const all = await localDB.getAll<StoredRecord>("records");
    return all.filter((r) => r.deleted_at == null);
  },
  async get(id: number): Promise<StoredRecord> {
    const r = await localDB.get<StoredRecord>("records", id);
    if (!r || r.deleted_at != null) notFound("记录不存在");
    return r as StoredRecord;
  },
  async create(input: RecordInput): Promise<StoredRecord> {
    const habit = await habitById(input.habit_id);
    const existing = (await localDB.recordsForHabit(input.habit_id)).filter(
      (r) => r.record_date === input.record_date
    );
    if (existing.length > 0) {
      throw new ApiError(409, "这一天已经记录过，请修改或删除原记录");
    }
    const id = await localDB.nextId("records");
    const isCompleted =
      input.is_completed ??
      isRecordCompleted(habit.record_type, {
        target_value: habit.target_value,
        value_number: input.value_number ?? null,
        value_text: input.value_text ?? null,
        value_time: input.value_time ?? null,
      });
    const now = new Date().toISOString();
    const record: StoredRecord = {
      id,
      habit_id: input.habit_id,
      record_date: input.record_date,
      value_number: input.value_number ?? null,
      value_text: input.value_text ?? null,
      value_time: input.value_time ?? null,
      is_completed: isCompleted,
      is_backfilled: input.is_backfilled ?? input.record_date !== todayISO(),
      note: input.note ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    await localDB.put("records", record);
    void reevaluateAchievements();
    return record;
  },
  async update(id: number, patch: Partial<RecordInput>): Promise<StoredRecord> {
    const record = await recordApi.get(id);
    const habit = await habitById(record.habit_id);
    const merged = { ...record, ...patch, id };
    merged.is_completed =
      patch.is_completed ??
      isRecordCompleted(habit.record_type, {
        target_value: habit.target_value,
        value_number: merged.value_number,
        value_text: merged.value_text,
        value_time: merged.value_time,
      });
    merged.updated_at = new Date().toISOString();
    await localDB.put("records", merged);
    void reevaluateAchievements();
    return merged;
  },
  async remove(id: number): Promise<void> {
    const record = await recordApi.get(id);
    record.deleted_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    await localDB.put("records", record);
    void reevaluateAchievements();
  },
};

// ---------- journal ----------

export const journalApi = {
  async get(date: string): Promise<StoredJournal> {
    const j = await localDB.get<StoredJournal>("journal", date);
    return (
      j ?? {
        journal_date: date,
        mood: null,
        energy: null,
        overall: null,
        stress: null,
        text: null,
        updated_at: null,
      }
    );
  },
  async update(date: string, data: Partial<StoredJournal>): Promise<StoredJournal> {
    const existing = await localDB.get<StoredJournal>("journal", date);
    const journal: StoredJournal = {
      journal_date: date,
      mood: data.mood ?? null,
      energy: data.energy ?? null,
      overall: data.overall ?? null,
      stress: data.stress ?? null,
      text: data.text ?? null,
      updated_at: new Date().toISOString(),
      ...(existing ? {} : { journal_date: date }),
    };
    await localDB.put("journal", journal);
    return journal;
  },
};

// ---------- bookkeeping: categories ----------

// Palette mirrors HabitForm's low-saturation colors.
const DEFAULT_CATEGORIES: Omit<StoredCategory, "id">[] = [
  { name: "餐饮", type: "expense", icon: "utensils", color: "#E89B5B", sort: 1, is_custom: false, deleted_at: null },
  { name: "交通", type: "expense", icon: "bus", color: "#5B8DEF", sort: 2, is_custom: false, deleted_at: null },
  { name: "购物", type: "expense", icon: "shopping-cart", color: "#8B7CF6", sort: 3, is_custom: false, deleted_at: null },
  { name: "娱乐", type: "expense", icon: "gamepad", color: "#D98BA0", sort: 4, is_custom: false, deleted_at: null },
  { name: "居住", type: "expense", icon: "home", color: "#18A396", sort: 5, is_custom: false, deleted_at: null },
  { name: "医疗", type: "expense", icon: "pill", color: "#4FA8C9", sort: 6, is_custom: false, deleted_at: null },
  { name: "教育", type: "expense", icon: "graduation-cap", color: "#6FA88F", sort: 7, is_custom: false, deleted_at: null },
  { name: "其他", type: "expense", icon: "more", color: "#7C8FA6", sort: 8, is_custom: false, deleted_at: null },
  { name: "工资", type: "income", icon: "wallet", color: "#2FA36B", sort: 1, is_custom: false, deleted_at: null },
  { name: "兼职", type: "income", icon: "briefcase", color: "#4FA8C9", sort: 2, is_custom: false, deleted_at: null },
  { name: "红包", type: "income", icon: "gift", color: "#E89B5B", sort: 3, is_custom: false, deleted_at: null },
  { name: "理财", type: "income", icon: "trending-up", color: "#8B7CF6", sort: 4, is_custom: false, deleted_at: null },
  { name: "其他", type: "income", icon: "more", color: "#7C8FA6", sort: 5, is_custom: false, deleted_at: null },
];

/** Seed the preset categories once, on first access. */
async function ensureCategories(): Promise<void> {
  const all = await localDB.getAll<StoredCategory>("categories");
  if (all.length > 0) return;
  let id = 1;
  for (const c of DEFAULT_CATEGORIES) {
    await localDB.put<StoredCategory>("categories", { ...c, id: id++ });
  }
}

export const categoryApi = {
  async list(type?: TxType): Promise<StoredCategory[]> {
    await ensureCategories();
    const all = await localDB.getAll<StoredCategory>("categories");
    return all
      .filter((c) => c.deleted_at == null && (!type || c.type === type))
      .sort((a, b) => a.type.localeCompare(b.type) || a.sort - b.sort || a.id - b.id);
  },
  async create(data: { name: string; type: TxType; icon: string; color: string }): Promise<StoredCategory> {
    const all = await localDB.getAll<StoredCategory>("categories");
    const sameType = all.filter((c) => c.type === data.type && c.deleted_at == null);
    const category: StoredCategory = {
      ...data,
      name: data.name.trim(),
      id: await localDB.nextId("categories"),
      sort: sameType.length + 1,
      is_custom: true,
      deleted_at: null,
    };
    await localDB.put("categories", category);
    return category;
  },
  async update(id: number, patch: Partial<Pick<StoredCategory, "name" | "icon" | "color">>): Promise<StoredCategory> {
    const c = await localDB.get<StoredCategory>("categories", id);
    if (!c || c.deleted_at != null) notFound("分类不存在");
    const updated: StoredCategory = {
      ...c,
      name: patch.name?.trim() ?? c.name,
      icon: patch.icon ?? c.icon,
      color: patch.color ?? c.color,
      id,
    };
    await localDB.put("categories", updated);
    return updated;
  },
  async remove(id: number): Promise<void> {
    const c = await localDB.get<StoredCategory>("categories", id);
    if (!c) notFound("分类不存在");
    c.deleted_at = new Date().toISOString();
    await localDB.put("categories", c);
  },
};

// ---------- bookkeeping: transactions ----------

export interface TransactionInput {
  type: TxType;
  amount: number; // cents (integer) — UI converts from yuan input
  category_id: number;
  note?: string | null;
  tx_date: string; // YYYY-MM-DD
}

async function categoryById(id: number): Promise<StoredCategory> {
  const c = await localDB.get<StoredCategory>("categories", id);
  if (!c || c.deleted_at != null) notFound("分类不存在");
  return c as StoredCategory;
}

export const transactionApi = {
  /** List entries, newest first. month filters as "YYYY-MM". */
  async list(params: { month?: string } = {}): Promise<StoredTransaction[]> {
    const all = await localDB.getAll<StoredTransaction>("transactions");
    return all
      .filter((t) => t.deleted_at == null && (!params.month || t.tx_date.startsWith(params.month)))
      .sort((a, b) => b.tx_date.localeCompare(a.tx_date) || b.id - a.id);
  },
  async get(id: number): Promise<StoredTransaction> {
    const t = await localDB.get<StoredTransaction>("transactions", id);
    if (!t || t.deleted_at != null) notFound("记录不存在");
    return t as StoredTransaction;
  },
  async create(input: TransactionInput): Promise<StoredTransaction> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new ApiError(400, "金额无效");
    }
    await categoryById(input.category_id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tx_date)) {
      throw new ApiError(400, "日期无效");
    }
    const now = new Date().toISOString();
    const tx: StoredTransaction = {
      id: await localDB.nextId("transactions"),
      type: input.type,
      amount: input.amount,
      category_id: input.category_id,
      note: input.note?.trim() || null,
      tx_date: input.tx_date,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    await localDB.put("transactions", tx);
    return tx;
  },
  async update(id: number, patch: Partial<TransactionInput>): Promise<StoredTransaction> {
    const t = await transactionApi.get(id);
    const merged = { ...t, ...patch, id };
    if (!Number.isInteger(merged.amount) || merged.amount <= 0) {
      throw new ApiError(400, "金额无效");
    }
    if (merged.type !== "expense" && merged.type !== "income") {
      throw new ApiError(400, "类型无效");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(merged.tx_date)) {
      throw new ApiError(400, "日期无效");
    }
    if (patch.category_id !== undefined) await categoryById(patch.category_id);
    merged.note = merged.note?.trim() || null;
    merged.updated_at = new Date().toISOString();
    await localDB.put("transactions", merged);
    return merged;
  },
  async remove(id: number): Promise<void> {
    const t = await transactionApi.get(id);
    t.deleted_at = new Date().toISOString();
    t.updated_at = new Date().toISOString();
    await localDB.put("transactions", t);
  },
};

// ---------- notifications settings ----------

const SETTINGS_KEY = "default";

export const notificationApi = {
  async getSettings(): Promise<{ daily_summary_enabled: boolean; daily_summary_time: string; habit_reminders_enabled: boolean }> {
    const s = await localDB.get<StoredNotificationSettings>("notification_settings", SETTINGS_KEY);
    return {
      daily_summary_enabled: s?.daily_summary_enabled ?? false,
      daily_summary_time: s?.daily_summary_time ?? "22:00",
      habit_reminders_enabled: s?.habit_reminders_enabled ?? false,
    };
  },
  async updateSettings(data: { daily_summary_enabled?: boolean; daily_summary_time?: string; habit_reminders_enabled?: boolean }): Promise<unknown> {
    const prev = await notificationApi.getSettings();
    const merged: StoredNotificationSettings = {
      key: SETTINGS_KEY,
      daily_summary_enabled: data.daily_summary_enabled ?? prev.daily_summary_enabled,
      daily_summary_time: data.daily_summary_time ?? prev.daily_summary_time,
      habit_reminders_enabled: data.habit_reminders_enabled ?? prev.habit_reminders_enabled,
    };
    await localDB.put("notification_settings", merged);
    return merged;
  },
  async pending(): Promise<{ pending: { habit_id: number; name: string; icon: string; reminder_time: string; message: string }[]; daily_summary_enabled: boolean; daily_summary_time: string }> {
    const settings = await notificationApi.getSettings();
    const habits = (await localDB.getAll<StoredHabit>("habits")).filter(
      (h) => !h.deleted_at && h.is_active && h.reminder_enabled && h.reminder_time
    );
    const today = todayISO();
    const done = new Set((await localDB.recordsOnDate(today)).filter((r) => r.is_completed).map((r) => r.habit_id));
    const pending = habits
      .filter((h) => !done.has(h.id))
      .map((h) => ({
        habit_id: h.id,
        name: h.name,
        icon: h.icon,
        reminder_time: h.reminder_time || "",
        message: `今天还没有完成「${h.name}」。`,
      }));
    return {
      pending,
      daily_summary_enabled: settings.daily_summary_enabled,
      daily_summary_time: settings.daily_summary_time,
    };
  },
  async inbox(): Promise<StoredInboxItem[]> {
    const all = await localDB.getAll<StoredInboxItem>("inbox");
    return all.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
  },
  async markAllRead(): Promise<void> {
    const all = await localDB.getAll<StoredInboxItem>("inbox");
    for (const item of all) {
      if (!item.is_read) {
        item.is_read = true;
        await localDB.put("inbox", item);
      }
    }
  },
};

// ---------- users (local profile) ----------

export const userApi = {
  async me(): Promise<{ id: number; username: string; email: string; timezone: string }> {
    const stored = localStorage.getItem("hf-profile");
    if (stored) return JSON.parse(stored);
    const profile = { id: 1, username: "我", email: "local@habitflow", timezone: "Asia/Shanghai" };
    localStorage.setItem("hf-profile", JSON.stringify(profile));
    return profile;
  },
  async update(data: { username?: string; timezone?: string }): Promise<unknown> {
    const me = await userApi.me();
    const updated = { ...me, ...data };
    localStorage.setItem("hf-profile", JSON.stringify(updated));
    return updated;
  },
  async changePassword(): Promise<void> {
    // local mode: no server password
    return;
  },
};

// ---------- export ----------

export function exportData(kind: "json" | "csv") {
  void (async () => {
    const habits = await localDB.getAll<StoredHabit>("habits");
    const records = (await localDB.getAll<StoredRecord>("records")).filter((r) => r.deleted_at == null);
    const journals = await localDB.getAll<StoredJournal>("journal");
    const transactions = (await localDB.getAll<StoredTransaction>("transactions")).filter((t) => t.deleted_at == null);
    const categories = await localDB.getAll<StoredCategory>("categories");
    const data = {
      exported_at: new Date().toISOString(),
      habits,
      records,
      journals,
      transactions,
      categories,
      statistics: { note: "本地模式：统计可从历史数据重算" },
    };

    let content: string;
    let mime: string;
    if (kind === "json") {
      content = JSON.stringify(data, null, 2);
      mime = "application/json";
    } else {
      const rows: string[][] = [];
      rows.push(["== habits =="]);
      if (habits.length) {
        rows.push(Object.keys(habits[0]));
        for (const h of habits) rows.push(Object.values(h).map((v) => String(v)));
      }
      rows.push([]);
      rows.push(["== records =="]);
      if (records.length) {
        rows.push(Object.keys(records[0]));
        for (const r of records) rows.push(Object.values(r).map((v) => String(v)));
      }
      rows.push([]);
      rows.push(["== transactions =="]);
      if (transactions.length) {
        rows.push(Object.keys(transactions[0]));
        for (const t of transactions) rows.push(Object.values(t).map((v) => String(v)));
      }
      rows.push([]);
      rows.push(["== categories =="]);
      if (categories.length) {
        rows.push(Object.keys(categories[0]));
        for (const c of categories) rows.push(Object.values(c).map((v) => String(v)));
      }
      content = "\ufeff" + rows.map((r) => r.join(",")).join("\n");
      mime = "text/csv;charset=utf-8";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habitflow-export.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  })();
}

// ---------- import ----------

export interface ImportResult {
  habits: number;
  records: number;
  journals: number;
  transactions: number;
  categories: number;
  skipped: number;
}

const HABIT_KEYS: (keyof StoredHabit)[] = [
  "id", "name", "description", "icon", "color", "category", "record_type", "target_value",
  "unit", "select_options", "schedule_type", "weekly_target", "weekly_days", "start_date",
  "end_date", "reminder_time", "reminder_enabled", "is_active", "show_on_homepage",
  "counts_for_daily", "allow_backfill", "created_at", "deleted_at",
];
const RECORD_KEYS: (keyof StoredRecord)[] = [
  "id", "habit_id", "record_date", "value_number", "value_text", "value_time",
  "is_completed", "is_backfilled", "note", "created_at", "updated_at", "deleted_at",
];
const JOURNAL_KEYS: (keyof StoredJournal)[] = [
  "journal_date", "mood", "energy", "overall", "stress", "text", "updated_at",
];
const TRANSACTION_KEYS: (keyof StoredTransaction)[] = [
  "id", "type", "amount", "category_id", "note", "tx_date", "created_at", "updated_at", "deleted_at",
];
const CATEGORY_KEYS: (keyof StoredCategory)[] = [
  "id", "name", "type", "icon", "color", "sort", "is_custom", "deleted_at",
];

/** Import a JSON export file. Adds new records; skips conflicting ids. Never wipes existing data. */
export async function importData(raw: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "文件不是有效的 JSON");
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj || typeof obj !== "object") throw new ApiError(400, "文件格式不正确");
  const habitRows = Array.isArray(obj.habits) ? (obj.habits as Record<string, unknown>[]) : [];
  const recordRows = Array.isArray(obj.records) ? (obj.records as Record<string, unknown>[]) : [];
  const journalRows = Array.isArray(obj.journals) ? (obj.journals as Record<string, unknown>[]) : [];
  const txRows = Array.isArray(obj.transactions) ? (obj.transactions as Record<string, unknown>[]) : [];
  const catRows = Array.isArray(obj.categories) ? (obj.categories as Record<string, unknown>[]) : [];
  if (!habitRows.length && !recordRows.length && !journalRows.length && !txRows.length && !catRows.length) {
    throw new ApiError(400, "文件中没有可导入的数据");
  }

  const sanitize = <T>(row: Record<string, unknown>, keys: (keyof T)[], typeName: string): T => {
    const out = {} as T;
    for (const k of keys) {
      if (k === "id") continue; // id assigned below
      const v = row[k as string];
      if (v !== undefined) (out as Record<string, unknown>)[k as string] = v;
    }
    if (!(out as Record<string, unknown>)[keys[1] as string] && typeName === "journal") {
      throw new ApiError(400, `日志数据缺少必填字段 ${String(keys[1])}`);
    }
    return out;
  };

  let skipped = 0;

  // categories: merge by id first (transactions reference them)
  const existingCategoryIds = new Set((await localDB.getAll<StoredCategory>("categories")).map((c) => c.id));
  let categoriesAdded = 0;
  for (const row of catRows) {
    const id = Number(row.id);
    if (!Number.isInteger(id) || id <= 0 || existingCategoryIds.has(id)) {
      skipped += 1;
      continue;
    }
    const category = sanitize<StoredCategory>(row, CATEGORY_KEYS, "category") as StoredCategory;
    category.id = id;
    if (!category.name || (category.type !== "expense" && category.type !== "income")) {
      skipped += 1;
      continue;
    }
    await localDB.put<StoredCategory>("categories", category);
    existingCategoryIds.add(id);
    categoriesAdded += 1;
  }

  // habits: merge by id (keep existing on conflict)
  const existingHabitIds = new Set((await localDB.getAll<StoredHabit>("habits")).map((h) => h.id));
  let habitsAdded = 0;
  for (const row of habitRows) {
    const id = Number(row.id);
    if (!Number.isInteger(id) || id <= 0 || existingHabitIds.has(id)) {
      skipped += 1;
      continue;
    }
    const habit = sanitize<StoredHabit>(row, HABIT_KEYS, "habit") as StoredHabit;
    habit.id = id;
    if (!habit.name) {
      skipped += 1;
      continue;
    }
    await localDB.put<StoredHabit>("habits", habit);
    existingHabitIds.add(id);
    habitsAdded += 1;
  }

  // records: merge by id
  const existingRecordIds = new Set((await localDB.getAll<StoredRecord>("records")).map((r) => r.id));
  let recordsAdded = 0;
  for (const row of recordRows) {
    const id = Number(row.id);
    if (!Number.isInteger(id) || id <= 0 || existingRecordIds.has(id)) {
      skipped += 1;
      continue;
    }
    const record = sanitize<StoredRecord>(row, RECORD_KEYS, "record") as StoredRecord;
    record.id = id;
    if (record.habit_id == null || !record.record_date) {
      skipped += 1;
      continue;
    }
    await localDB.put<StoredRecord>("records", record);
    existingRecordIds.add(id);
    recordsAdded += 1;
  }

  // journals: upsert by journal_date
  const existingJournalDates = new Set((await localDB.getAll<StoredJournal>("journal")).map((j) => j.journal_date));
  let journalsAdded = 0;
  for (const row of journalRows) {
    const d = String(row.journal_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      skipped += 1;
      continue;
    }
    const journal = sanitize<StoredJournal>(row, JOURNAL_KEYS, "journal") as StoredJournal;
    journal.journal_date = d;
    await localDB.put<StoredJournal>("journal", journal);
    if (!existingJournalDates.has(d)) journalsAdded += 1;
    existingJournalDates.add(d);
  }

  // transactions: merge by id
  const existingTxIds = new Set((await localDB.getAll<StoredTransaction>("transactions")).map((t) => t.id));
  let txAdded = 0;
  for (const row of txRows) {
    const id = Number(row.id);
    if (!Number.isInteger(id) || id <= 0 || existingTxIds.has(id)) {
      skipped += 1;
      continue;
    }
    const tx = sanitize<StoredTransaction>(row, TRANSACTION_KEYS, "transaction") as StoredTransaction;
    tx.id = id;
    if (
      (tx.type !== "expense" && tx.type !== "income") ||
      !Number.isInteger(tx.amount) ||
      tx.amount <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(tx.tx_date || "")
    ) {
      skipped += 1;
      continue;
    }
    await localDB.put<StoredTransaction>("transactions", tx);
    existingTxIds.add(id);
    txAdded += 1;
  }

  return { habits: habitsAdded, records: recordsAdded, journals: journalsAdded, transactions: txAdded, categories: categoriesAdded, skipped };
}

// ---------- local notification generation ----------
// Local mode has no push backend, so we synthesize inbox items:
//  (1) achievement unlocks (evaluated once per day)
//  (2) daily summary at the configured time (once per day)

const ACHIEVE_EVAL_KEY = "hf-achievement-eval";
const SUMMARY_SENT_KEY = "hf-summary-sent";

async function nextInboxId(): Promise<number> {
  const all = await localDB.getAll<StoredInboxItem>("inbox");
  return all.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

export async function generateLocalNotifications(): Promise<void> {
  // 1) Achievement unlocks — evaluate once per day
  try {
    const today = todayISO();
    if (localStorage.getItem(ACHIEVE_EVAL_KEY) !== today) {
      const newly = await evaluateAchievements();
      if (newly.length) {
        let id = await nextInboxId();
        for (const label of newly) {
          await localDB.put<StoredInboxItem>("inbox", {
            id: id++,
            title: "成就解锁 🏅",
            body: `恭喜！解锁成就「${label}」。`,
            kind: "achievement",
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
      localStorage.setItem(ACHIEVE_EVAL_KEY, today);
    }
  } catch {
    /* ignore — evaluation failures must never break the app */
  }

  // 2) Daily summary — fire once per day when the clock matches
  try {
    const settings = await localDB.get<StoredNotificationSettings>("notification_settings", SETTINGS_KEY);
    if (settings?.daily_summary_enabled && settings.daily_summary_time) {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = todayISO();
      if (hhmm === settings.daily_summary_time && localStorage.getItem(SUMMARY_SENT_KEY) !== today) {
        const habits = (await localDB.getAll<StoredHabit>("habits")).filter(
          (h) => !h.deleted_at && h.is_active && h.show_on_homepage && h.schedule_type !== "weekly_count"
        );
        const done = new Set(
          (await localDB.recordsOnDate(today)).filter((r) => r.deleted_at == null && r.is_completed).map((r) => r.habit_id)
        );
        const pending = habits.filter((h) => !done.has(h.id));
        const id = await nextInboxId();
        await localDB.put<StoredInboxItem>("inbox", {
          id,
          title: "每日小结 📋",
          body:
            pending.length === 0
              ? `今天全部完成 🎉 共 ${habits.length} 个习惯。`
              : `今天完成了 ${habits.length - pending.length}/${habits.length} 个习惯${pending.length ? `，还有 ${pending.length} 个待完成` : ""}。`,
          kind: "summary",
          is_read: false,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem(SUMMARY_SENT_KEY, today);
      }
    }
  } catch {
    /* ignore */
  }
}
