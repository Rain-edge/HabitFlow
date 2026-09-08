import { useCallback, useEffect, useRef, useState } from "react";
import { api, downloadExport, importLocalData } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Layout";
import { useAuth } from "../state/auth";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const [summaryTime, setSummaryTime] = useState("22:00");
  const [habitReminders, setHabitReminders] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImportFile = async (f: File) => {
    try {
      const text = await f.text();
      const result = await importLocalData(text);
      toast(`导入完成：习惯 ${result.habits} · 记录 ${result.records} · 日志 ${result.journals}${result.skipped ? ` · 跳过 ${result.skipped}` : ""}`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const loadSettings = useCallback(async () => {
    const s = await api.get<{
      daily_summary_enabled: boolean;
      daily_summary_time: string;
      habit_reminders_enabled: boolean;
    }>("/notifications/settings");
    setSummaryEnabled(s.daily_summary_enabled);
    setSummaryTime(s.daily_summary_time);
    setHabitReminders(s.habit_reminders_enabled);
  }, []);

  useEffect(() => {
    loadSettings().catch(() => undefined);
  }, [loadSettings]);

  const saveProfile = async () => {
    try {
      await api.put("/users/me", { username });
      await refresh();
      toast("资料已保存", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const saveNotifications = async () => {
    try {
      await api.put("/notifications/settings", {
        daily_summary_enabled: summaryEnabled,
        daily_summary_time: summaryTime,
        habit_reminders_enabled: habitReminders,
      });
      toast("提醒设置已保存", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">设置</h1>

      <section className="card card-pad space-y-4">
        <h2 className="section-title">个人资料</h2>
        <div>
          <label className="label">昵称</label>
          <div className="flex items-end gap-2">
            <input
              className="input max-w-xs"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="给自己起个名字"
            />
            <button className="btn-primary shrink-0" onClick={saveProfile}>
              保存
            </button>
          </div>
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="section-title">提醒</h2>
        <label className="flex items-center justify-between text-sm text-ink-2">
          <span>习惯提醒（按每个习惯设置的提醒时间）</span>
          <input type="checkbox" checked={habitReminders} onChange={(e) => setHabitReminders(e.target.checked)} />
        </label>
        <label className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
          <span className="flex min-w-0 items-center gap-2">
            每日小结提醒
            {summaryEnabled && (
              <input className="input w-28 shrink-0" type="time" value={summaryTime} onChange={(e) => setSummaryTime(e.target.value)} />
            )}
          </span>
          <input type="checkbox" checked={summaryEnabled} onChange={(e) => setSummaryEnabled(e.target.checked)} />
        </label>
        <p className="text-xs text-ink-3">
          提醒以站内通知和浏览器通知呈现；需要浏览器授权通知权限。
        </p>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={saveNotifications}>保存</button>
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="section-title">数据与备份</h2>
        <p className="text-xs text-ink-3">
          所有数据保存在本机浏览器中（IndexedDB）。换设备或卸载应用前，建议先导出备份；导入 JSON 可从备份恢复，已存在的条目会跳过，不会覆盖现有数据。
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => downloadExport("json")}>
            导出 JSON
          </button>
          <button className="btn-ghost" onClick={() => downloadExport("csv")}>
            导出 CSV
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <button
            className="btn-ghost text-danger-500 hover:bg-danger-500/10 hover:text-danger-600"
            onClick={() => setConfirmClear(true)}
          >
            清除全部数据
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
          }}
        />
      </section>

      {confirmClear && (
        <ConfirmDialog
          title="清除全部本地数据？"
          description="此操作不可恢复，建议先导出备份。"
          confirmLabel="清除"
          danger
          onConfirm={() => {
            void (async () => {
              try {
                const { localDB } = await import("../local/db");
                await localDB.clear("habits");
                await localDB.clear("records");
                await localDB.clear("journal");
                await localDB.clear("notification_settings");
                await localDB.clear("achievements");
                await localDB.clear("inbox");
                localStorage.removeItem("hf-profile");
                window.location.reload();
              } catch {
                toast("清除失败", "error");
              }
            })();
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
