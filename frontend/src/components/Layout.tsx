import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from "@capacitor/core";
import { api, runLocalNotifications } from "../api/client";
import { useAuth } from "../state/auth";
import { todayISO } from "../utils/date";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import Logo from "./Logo";

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "今天", icon: "home", end: true },
  { to: "/habits", label: "习惯", icon: "sprout" },
  { to: "/calendar", label: "日历", icon: "calendar" },
  { to: "/transactions", label: "记账", icon: "wallet" },
  { to: "/statistics", label: "统计", icon: "stats" },
  { to: "/journal", label: "日志", icon: "journal" },
  { to: "/settings", label: "设置", icon: "settings" },
];

type ToastKind = "success" | "error" | "info";

export function toast(message: string, kind: ToastKind = "info") {
  window.dispatchEvent(new CustomEvent("hf-toast", { detail: { message, kind } }));
}

interface InboxItem {
  id: number;
  title: string;
  body: string | null;
  kind: string;
  is_read: boolean;
  created_at: string;
}

export default function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: ToastKind }[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [hintOpen, setHintOpen] = useState(false);
  const toastId = useRef(0);
  const gPressed = useRef(false);

  // Keep status-bar icon color in sync with the app theme (native only).
  const applySystemBarStyle = useCallback((isDark: boolean) => {
    if (!Capacitor.isNativePlatform()) return;
    void SystemBars.setStyle({
      bar: SystemBarType.StatusBar,
      style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    }).catch(() => {
      /* non-fatal */
    });
  }, []);

  useEffect(() => {
    applySystemBarStyle(dark);
  }, [dark, applySystemBarStyle]);

  // Global shortcuts: g+<key> navigates, ? toggles help, Esc closes help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape") {
        setHintOpen(false);
        return;
      }
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setHintOpen((o) => !o);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "g") {
        gPressed.current = true;
        return;
      }
      if (gPressed.current) {
        gPressed.current = false;
        if (k === "h") navigate("/");
        else if (k === "c") navigate("/calendar");
        else if (k === "b") navigate("/transactions");
        else if (k === "s") navigate("/statistics");
        else if (k === "j") navigate("/journal");
        else if (k === "n") navigate("/habits?new=1");
        else if (k === "g") navigate("/habits");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("hf-theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, kind } = (e as CustomEvent).detail;
      const id = ++toastId.current;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener("hf-toast", handler);
    return () => window.removeEventListener("hf-toast", handler);
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const items = await api.get<InboxItem[]>("/notifications/inbox?limit=30");
      setInbox(items);
      setUnread(items.filter((i) => !i.is_read).length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadInbox();
    const t = setInterval(loadInbox, 60_000);
    return () => clearInterval(t);
  }, [loadInbox]);

  // Local-mode inbox source: evaluate achievements once a day + daily summary at set time.
  useEffect(() => {
    runLocalNotifications();
    const t = setInterval(runLocalNotifications, 60_000);
    return () => clearInterval(t);
  }, []);

  // Browser notification watcher: matches pending reminders against clock.
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();

    const check = async () => {
      try {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const data = await api.get<{
          pending: { habit_id: number; name: string; reminder_time: string; message: string }[];
          daily_summary_enabled: boolean;
          daily_summary_time: string;
        }>("/notifications/pending");

        const fired = sessionStorage.getItem("hf-fired") || "";
        const firedSet = new Set(fired.split(",").filter(Boolean));

        for (const p of data.pending) {
          if (p.reminder_time === hhmm && !firedSet.has(`h${p.habit_id}:${todayISO()}`)) {
            if (Notification.permission === "granted")
              new Notification("HabitFlow 提醒", { body: p.message });
            firedSet.add(`h${p.habit_id}:${todayISO()}`);
          }
        }
        if (
          data.daily_summary_enabled &&
          data.daily_summary_time === hhmm &&
          data.pending.length > 0 &&
          !firedSet.has(`summary:${todayISO()}`)
        ) {
          if (Notification.permission === "granted")
            new Notification("HabitFlow 小结", {
              body: `今天还有 ${data.pending.length} 个习惯没有完成。`,
            });
          firedSet.add(`summary:${todayISO()}`);
        }
        sessionStorage.setItem("hf-fired", [...firedSet].join(","));
      } catch {
        /* ignore */
      }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  const markAllRead = async () => {
    await api.post("/notifications/inbox/read-all");
    await loadInbox();
  };

  const navItems = NAV.map((n) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive ? "bg-brand-500/10 text-brand-600 dark:text-brand-300" : "text-ink-2 hover:bg-line-2"
        }`
      }
    >
      <Icon name={n.icon} className="h-5 w-5 shrink-0" strokeWidth={1.8} />
      {n.label}
    </NavLink>
  ));

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-line bg-card p-4 lg:block">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <Logo size={30} />
          <span className="font-display text-lg font-bold tracking-tight text-ink">HabitFlow</span>
        </div>
        <nav className="space-y-1">{navItems}</nav>
        <div className="mt-8 border-t border-line-2 pt-4">
          <div className="px-2 text-xs text-ink-3">
            <div className="text-ink-2">{user?.username}</div>
            <div className="mt-0.5 text-ink-3">本地模式 · 数据保存在此设备</div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top bar — the native layer reserves the status-bar space (MainActivity
            pads the WebView host), so no extra safe-area padding is needed here. */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-card/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo size={26} />
            <span className="font-display font-bold tracking-tight">HabitFlow</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="icon-btn" onClick={toggleTheme} aria-label="切换主题" title="切换主题">
              <Icon name={dark ? "sun" : "moon"} className="h-5 w-5" />
            </button>
            <div className="relative">
            <button
              className="relative rounded-lg p-2 text-lg hover:bg-line-2"
              onClick={() => {
                setInboxOpen((o) => !o);
                loadInbox();
              }}
              aria-label="通知"
            >
              <Icon name="bell" className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {inboxOpen && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-card p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">通知</span>
                  <button className="text-xs text-brand-600 hover:underline" onClick={markAllRead}>
                    全部已读
                  </button>
                </div>
                <div className="max-h-72 space-y-2 overflow-auto">
                  {inbox.length === 0 && <div className="py-6 text-center text-xs text-ink-3">暂无通知</div>}
                  {inbox.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-lg p-2 text-xs ${n.is_read ? "bg-card-2 text-ink-2" : "bg-brand-500/10 text-ink"}`}
                    >
                      <div className="font-medium">{n.title}</div>
                      {n.body && <div className="mt-0.5 text-ink-3">{n.body}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-6 lg:pb-10">
          <Outlet />
        </main>

        {/* Mobile bottom nav — native layer reserves the gesture-bar space.
            7 items: tighter padding keeps labels on one line at 360px. */}
        <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-card py-2 lg:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] ${
                  isActive ? "text-brand-600" : "text-ink-3"
                }`
              }
            >
              <span className="text-base leading-none">
                <Icon name={n.icon} className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex animate-toast-in items-center gap-2 rounded-lg px-4 py-2 text-sm text-white shadow-lg ${
              t.kind === "error" ? "bg-danger-500" : t.kind === "success" ? "bg-success-500" : "bg-ink text-card"
            }`}
          >
            {t.kind === "error" && <Icon name="alert" className="h-4 w-4 shrink-0" />}
            {t.kind === "success" && <Icon name="check" className="h-4 w-4 shrink-0" strokeWidth={2.4} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Shortcut hint */}
      {hintOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setHintOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-semibold text-ink">快捷键</span>
              <button className="rounded-lg p-1 text-ink-3 hover:bg-line-2" onClick={() => setHintOpen(false)} aria-label="关闭">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["g + h", "首页"],
                ["g + n", "新建习惯"],
                ["g + c", "日历"],
                ["g + b", "记账"],
                ["g + s", "统计"],
                ["g + j", "日志"],
                ["?", "显示 / 隐藏本面板"],
                ["Esc", "关闭弹窗"],
              ].map(([keys, label]) => (
                <div key={keys} className="flex items-center justify-between">
                  <span className="text-ink-2">{label}</span>
                  <kbd className="rounded-md bg-line-2 px-2 py-0.5 font-mono text-xs text-ink">{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
