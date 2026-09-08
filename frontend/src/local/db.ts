// Local persistent storage layer (IndexedDB) — replaces the FastAPI backend.
// Tables: habits, records, journal, notification_settings, achievements, inbox.

const DB_NAME = "habitflow";
const DB_VERSION = 1;

export type StoreName = "habits" | "records" | "journal" | "notification_settings" | "achievements" | "inbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("habits")) {
        const s = db.createObjectStore("habits", { keyPath: "id" });
        s.createIndex("deleted_at", "deleted_at");
      }
      if (!db.objectStoreNames.contains("records")) {
        const s = db.createObjectStore("records", { keyPath: "id", autoIncrement: true });
        s.createIndex("habit_id_date", ["habit_id", "record_date"]);
        s.createIndex("record_date", "record_date");
      }
      if (!db.objectStoreNames.contains("journal")) {
        db.createObjectStore("journal", { keyPath: "journal_date" });
      }
      if (!db.objectStoreNames.contains("notification_settings")) {
        db.createObjectStore("notification_settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("achievements")) {
        const s = db.createObjectStore("achievements", { keyPath: "id", autoIncrement: true });
        s.createIndex("code_habit", ["code", "habit_id"]);
      }
      if (!db.objectStoreNames.contains("inbox")) {
        const s = db.createObjectStore("inbox", { keyPath: "id", autoIncrement: true });
        s.createIndex("is_read", "is_read");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

// ---- In-memory read cache ----
// Speeds up repeated page loads: once a store is read, subsequent reads in the
// same session hit memory instead of IndexedDB. Invalidated on every write.
const cache = new Map<StoreName, unknown[]>();

function invalidate(store: StoreName) {
  cache.delete(store);
}

export const localDB = {
  async getAll<T>(store: StoreName): Promise<T[]> {
    if (cache.has(store)) return cache.get(store) as T[];
    const rows = await tx(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
    cache.set(store, rows);
    return rows;
  },
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return tx(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
  },
  put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
    invalidate(store);
    return tx(store, "readwrite", (s) => s.put(value));
  },
  delete(store: StoreName, key: IDBValidKey): Promise<undefined> {
    invalidate(store);
    return tx(store, "readwrite", (s) => s.delete(key));
  },
  clear(store: StoreName): Promise<undefined> {
    invalidate(store);
    return tx(store, "readwrite", (s) => s.clear());
  },
  /** Query by an index. */
  getByIndex<T>(store: StoreName, index: string, key: IDBValidKey): Promise<T[]> {
    return openDB().then(
      (db) =>
        new Promise<T[]>((resolve, reject) => {
          const t = db.transaction(store, "readonly");
          const idx = t.objectStore(store).index(index);
          const req = idx.getAll(key);
          req.onsuccess = () => resolve(req.result as T[]);
          req.onerror = () => reject(req.error);
        })
    );
  },
  /** Get all records for a habit within a date range (inclusive). */
  async recordsForHabit(habitId: number, startISO?: string, endISO?: string) {
    const all = await this.getAll<StoredRecord>("records");
    return all.filter(
      (r) =>
        r.habit_id === habitId &&
        r.deleted_at == null &&
        (!startISO || r.record_date >= startISO) &&
        (!endISO || r.record_date <= endISO)
    );
  },
  /** All records on a given date (across habits). */
  async recordsOnDate(dateISO: string) {
    const all = await this.getAll<StoredRecord>("records");
    return all.filter((r) => r.record_date === dateISO && r.deleted_at == null);
  },
  async nextId(store: StoreName): Promise<number> {
    const all = await this.getAll<{ id: number }>(store);
    return all.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  },
};

// ============ Stored entity shapes (mirror backend models) ============

export interface StoredHabit {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category: string;
  record_type: string;
  target_value: number | null;
  unit: string | null;
  select_options: string[] | null;
  schedule_type: string;
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

export interface StoredRecord {
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
  deleted_at: string | null;
}

export interface StoredJournal {
  journal_date: string;
  mood: number | null;
  energy: number | null;
  overall: number | null;
  stress: number | null;
  text: string | null;
  updated_at: string | null;
}

export interface StoredNotificationSettings {
  key: string;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  habit_reminders_enabled: boolean;
}

export interface StoredAchievement {
  id: number;
  code: string;
  habit_id: number | null;
  habit_name: string | null;
  unlocked_at: string;
}

export interface StoredInboxItem {
  id: number;
  title: string;
  body: string | null;
  kind: string;
  is_read: boolean;
  created_at: string;
}
