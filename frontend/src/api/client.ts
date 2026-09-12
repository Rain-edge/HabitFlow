// Local API adapter — keeps the exact call shape pages already use:
//   api.get<T>("/habits"), api.post("/records", {...}), api.put(...), api.delete(...)
// but routes everything to IndexedDB via the local facade.
import { habitApi, recordApi, journalApi, notificationApi, userApi, exportData, importData, generateLocalNotifications, ApiError } from "../local/api";
import {
  calendar as localCalendar,
  evaluateAchievements,
  getHabitStats,
  listAchievements,
  overview as localOverview,
  todayDashboard,
  trend as localTrend,
  yearHeatmap,
} from "../local/stats";

export function getToken(): string | null {
  return null; // local mode: no auth token
}
export function setToken(): void {
  /* no-op */
}

export { ApiError };

function parseQuery(path: string): [string, URLSearchParams] {
  const q = path.indexOf("?");
  if (q === -1) return [path, new URLSearchParams()];
  return [path.slice(0, q), new URLSearchParams(path.slice(q + 1))];
}

async function handleGet<T>(path: string): Promise<T> {
  const [base, query] = parseQuery(path);

  if (base === "/users/me") return userApi.me() as unknown as T;
  if (base === "/habits") {
    return habitApi.list(query.get("include_deleted") === "true") as unknown as T;
  }
  if (base === "/records") {
    const onDate = query.get("on_date");
    const habitId = query.get("habit_id");
    const limit = query.get("limit");
    const habitIdNum = habitId && Number.isInteger(Number(habitId)) && Number(habitId) > 0 ? Number(habitId) : undefined;
    const limitNum = limit && Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : undefined;
    return recordApi.list({
      on_date: onDate || undefined,
      habit_id: habitIdNum,
      limit: limitNum,
    }) as unknown as T;
  }
  if (base === "/notifications/settings") return notificationApi.getSettings() as unknown as T;
  if (base === "/notifications/pending") return notificationApi.pending() as unknown as T;
  if (base === "/notifications/inbox") return notificationApi.inbox() as unknown as T;
  if (base === "/achievements") return listAchievements() as unknown as T;
  if (base === "/statistics/today") return todayDashboard() as unknown as T;
  if (base === "/statistics/overview") {
    return localOverview(query.get("range") || "30d") as unknown as T;
  }
  if (base === "/statistics/trend") {
    return localTrend(Number(query.get("days") || 30)) as unknown as T;
  }
  if (base === "/statistics/calendar") {
    return localCalendar(Number(query.get("year")), Number(query.get("month"))) as unknown as T;
  }
  if (base === "/statistics/heatmap") {
    return yearHeatmap(Number(query.get("days") || 364)) as unknown as T;
  }

  // /journal/{date}
  const jm = base.match(/^\/journal\/(\d{4}-\d{2}-\d{2})$/);
  if (jm) return journalApi.get(jm[1]) as unknown as T;

  // /habits/{id}
  const hm = base.match(/^\/habits\/(\d+)$/);
  if (hm) return habitApi.get(Number(hm[1])) as unknown as T;

  // /records/{id}
  const rm = base.match(/^\/records\/(\d+)$/);
  if (rm) return recordApi.get(Number(rm[1])) as unknown as T;

  // /statistics/habit/{id}
  const shm = base.match(/^\/statistics\/habit\/(\d+)$/);
  if (shm) {
    const habit = await habitApi.get(Number(shm[1]));
    return getHabitStats(habit) as unknown as T;
  }

  throw new ApiError(404, `未找到接口 ${path}`);
}

async function handlePost<T>(path: string, body?: unknown): Promise<T> {
  const [base] = parseQuery(path);

  if (base === "/habits") return habitApi.create(body as never) as unknown as T;
  if (base === "/records") return recordApi.create(body as never) as unknown as T;
  if (base === "/users/me/password") {
    await userApi.changePassword();
    return undefined as T;
  }
  if (base === "/notifications/inbox/read-all") {
    await notificationApi.markAllRead();
    return undefined as T;
  }
  if (base === "/achievements/evaluate") {
    const newly = await evaluateAchievements();
    return { newly_unlocked: newly } as unknown as T;
  }

  const rm = base.match(/^\/habits\/(\d+)\/restore$/);
  if (rm) return habitApi.restore(Number(rm[1])) as unknown as T;

  throw new ApiError(404, `未找到接口 ${path}`);
}

async function handlePut<T>(path: string, body?: unknown): Promise<T> {
  const [base] = parseQuery(path);

  if (base === "/users/me") return userApi.update(body as never) as unknown as T;
  if (base === "/notifications/settings") return notificationApi.updateSettings(body as never) as unknown as T;

  const jm = base.match(/^\/journal\/(\d{4}-\d{2}-\d{2})$/);
  if (jm) return journalApi.update(jm[1], body as never) as unknown as T;

  const hm = base.match(/^\/habits\/(\d+)$/);
  if (hm) return habitApi.update(Number(hm[1]), body as never) as unknown as T;

  const rm = base.match(/^\/records\/(\d+)$/);
  if (rm) return recordApi.update(Number(rm[1]), body as never) as unknown as T;

  throw new ApiError(404, `未找到接口 ${path}`);
}

async function handleDelete<T>(path: string): Promise<T> {
  const [base] = parseQuery(path);
  const hm = base.match(/^\/habits\/(\d+)$/);
  if (hm) {
    await habitApi.remove(Number(hm[1]));
    return undefined as T;
  }
  const rm = base.match(/^\/records\/(\d+)$/);
  if (rm) {
    await recordApi.remove(Number(rm[1]));
    return undefined as T;
  }
  const jm = base.match(/^\/journal\/(\d{4}-\d{2}-\d{2})$/);
  if (jm) {
    await journalApi.update(jm[1], { mood: null, energy: null, overall: null, stress: null, text: null });
    return undefined as T;
  }
  throw new ApiError(404, `未找到接口 ${path}`);
}

export const api = {
  get: <T>(path: string) => handleGet<T>(path),
  post: <T>(path: string, body?: unknown) => handlePost<T>(path, body),
  put: <T>(path: string, body?: unknown) => handlePut<T>(path, body),
  delete: <T>(path: string) => handleDelete<T>(path),
};

export function downloadExport(kind: "json" | "csv") {
  exportData(kind);
}

export function importLocalData(raw: string) {
  return importData(raw);
}

/** Generate local inbox notifications (achievements + daily summary). Fire-and-forget. */
export function runLocalNotifications() {
  void generateLocalNotifications();
}
