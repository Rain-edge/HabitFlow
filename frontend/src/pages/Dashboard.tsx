import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CardMenu, { type CardMenuItem } from "../components/CardMenu";
import HabitForm from "../components/HabitForm";
import HabitIcon from "../components/HabitIcon";
import Icon from "../components/Icon";
import Motivation from "../components/Motivation";
import RecordDialog, { type ExistingRecord } from "../components/RecordDialog";
import { toast } from "../components/Layout";
import { EmptyState, PageLoading, ProgressBar, SectionTitle, StatCard } from "../components/ui";
import type { Overview } from "../local/stats";
import type { Habit, HabitRecord, TodayDashboard, TodayItem } from "../types";
import { addDays, formatCN, parseISO, todayISO, weekdayCN } from "../utils/date";

/** 与数据层 isScheduledOn 同口径的单日排程判定（weekly_count 不落单日）。 */
function scheduledOn(habit: Habit, d: string): boolean {
  if (d < habit.start_date || (habit.end_date && d > habit.end_date)) return false;
  if (habit.schedule_type === "daily") return true;
  if (habit.schedule_type === "weekly_days") {
    return (habit.weekly_days || []).includes((parseISO(d).getDay() + 6) % 7);
  }
  return false;
}

function CompletionRing({ rate, done, total }: { rate: number; done: number; total: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-line-2" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-brand-500 transition-all duration-500 ease-soft"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, rate)) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display num text-2xl font-extrabold text-ink">{Math.round(rate)}%</span>
        <span className="caption mt-0.5">
          {done}/{total} 完成
        </span>
      </div>
    </div>
  );
}

function recordSummary(item: TodayItem): string {
  const rec = item.record;
  if (!rec) return "";
  if (item.record_type === "number" || item.record_type === "duration") {
    const target = item.target_value != null ? ` / ${item.target_value}` : "";
    return `${rec.value_number ?? 0}${target} ${item.unit || ""}`;
  }
  if (item.record_type === "rating") return `${rec.value_number ?? "-"}/10`;
  if (item.record_type === "time") return rec.value_time || "";
  if (item.record_type === "select") return rec.value_text || "";
  if (item.record_type === "text") return rec.value_text ? "已记录" : "";
  return "";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<TodayDashboard | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [week, setWeek] = useState<Overview | null>(null);
  const [checkin, setCheckin] = useState<{ habit: Habit; date: string; existing: ExistingRecord | null } | null>(null);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [menu, setMenu] = useState<{ habit: Habit; item: TodayItem; x: number; y: number } | null>(null);
  const [yesterdayRecords, setYesterdayRecords] = useState<HabitRecord[]>([]);
  const [quickInput, setQuickInput] = useState<{ id: number; value: string } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pressingId, setPressingId] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    const yesterday = addDays(todayISO(), -1);
    const [dash, habitList, weekData, yRecords] = await Promise.all([
      api.get<TodayDashboard>("/statistics/today"),
      api.get<Habit[]>("/habits"),
      api.get<Overview>("/statistics/overview?range=week"),
      api.get<HabitRecord[]>(`/records?on_date=${yesterday}`),
    ]);
    setData(dash);
    setHabits(habitList);
    setWeek(weekData);
    setYesterdayRecords(yRecords);
  }, []);

  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, [load]);

  /** One-tap checkin for boolean habits. */
  const quickCheckin = async (item: TodayItem) => {
    if (item.done_today) return; // open edit dialog instead
    setSavingId(item.habit_id);
    try {
      await api.post("/records", {
        habit_id: item.habit_id,
        record_date: todayISO(),
        is_completed: true,
      });
      await load();
      toast("已打卡", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingId(null);
    }
  };

  /** Quick numeric input save (number / duration / rating).
   *  失焦自动保存不丢值（R-G）；无效输入保留输入框；当日已有记录走 PUT 原位续记。 */
  const quickSave = async (item: TodayItem, raw: string) => {
    if (raw.trim() === "") {
      setQuickInput(null);
      return;
    }
    const valueNumber = raw.includes(".") ? parseFloat(raw) : parseInt(raw, 10);
    if (Number.isNaN(valueNumber)) {
      toast("请输入有效数字", "error");
      return;
    }
    setQuickInput(null);
    setSavingId(item.habit_id);
    try {
      if (item.record && !item.record.is_skipped) {
        await api.put(`/records/${item.record.id}`, { value_number: valueNumber });
      } else {
        await api.post("/records", {
          habit_id: item.habit_id,
          record_date: todayISO(),
          value_number: valueNumber,
        });
      }
      await load();
      toast("已记录", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingId(null);
    }
  };

  /** R-G: 打开快速输入时预填——优先今日已有值，否则取该习惯上一次数值。 */
  const openQuickInput = async (item: TodayItem) => {
    let prefill = item.record?.value_number != null ? String(item.record.value_number) : "";
    if (!prefill) {
      try {
        const recent = await api.get<HabitRecord[]>(`/records?habit_id=${item.habit_id}&limit=3`);
        const last = recent.find((r) => !r.is_skipped && r.value_number != null);
        if (last?.value_number != null) prefill = String(last.value_number);
      } catch {
        // 预填失败不阻塞输入
      }
    }
    setQuickInput({ id: item.habit_id, value: prefill });
  };

  if (!data) return <PageLoading />;

  const visible = data.items
    .filter((i) => i.show_on_homepage)
    .sort((a, b) => Number(a.done_today) - Number(b.done_today));
  const dateISO = todayISO();
  const yesterdayISO = addDays(dateISO, -1);
  const bestStreak = visible.reduce((m, i) => Math.max(m, i.current_streak), 0);
  const todoCount = visible.filter((i) => i.scheduled_today && !i.done_today).length;

  const clearPress = () => {
    if (pressTimer.current != null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setPressingId(null);
  };

  /** R-F: 长按 500ms / 桌面右键唤出卡片快捷菜单；卡内控件与滚动不触发。 */
  const cardPressProps = (item: TodayItem) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, a, input")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      clearPress();
      setPressingId(item.habit_id);
      pressStart.current = { x: e.clientX, y: e.clientY };
      const px = e.clientX;
      const py = e.clientY;
      pressTimer.current = window.setTimeout(() => {
        pressTimer.current = null;
        setPressingId(null);
        const habit = habits.find((h) => h.id === item.habit_id);
        if (habit) setMenu({ habit, item, x: px, y: py });
      }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const start = pressStart.current;
      if (pressTimer.current != null && start && Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 12) {
        clearPress();
      }
    },
    onPointerUp: clearPress,
    onPointerCancel: clearPress,
    onContextMenu: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, a, input")) return;
      e.preventDefault();
      const habit = habits.find((h) => h.id === item.habit_id);
      if (habit) setMenu({ habit, item, x: e.clientX, y: e.clientY });
    },
  });

  const openRecord = (item: TodayItem) => {
    const habit = habits.find((h) => h.id === item.habit_id);
    if (!habit) return;
    setCheckin({
      habit,
      date: dateISO,
      existing: item.record
        ? {
            id: item.record.id,
            value_number: item.record.value_number,
            value_text: item.record.value_text,
            value_time: item.record.value_time,
            note: item.record.note,
            is_backfilled: item.record.is_backfilled,
          }
        : null,
    });
  };

  const menuItemsFor = (habit: Habit): CardMenuItem[] => {
    const yRec = yesterdayRecords.find((r) => r.habit_id === habit.id);
    const canBackfill = habit.allow_backfill && scheduledOn(habit, yesterdayISO) && !yRec?.is_completed && !yRec?.is_skipped;
    return [
      { key: "detail", label: "查看详情", icon: "clipboard", onSelect: () => navigate(`/habits/${habit.id}`) },
      { key: "edit", label: "编辑习惯", icon: "pencil", onSelect: () => setEditing(habit) },
      {
        key: "backfill",
        label: "补签到昨天",
        icon: "wrench",
        disabled: !canBackfill,
        onSelect: () =>
          setCheckin({
            habit,
            date: yesterdayISO,
            existing: yRec
              ? {
                  id: yRec.id,
                  value_number: yRec.value_number,
                  value_text: yRec.value_text,
                  value_time: yRec.value_time,
                  note: yRec.note,
                  is_backfilled: yRec.is_backfilled,
                }
              : null,
          }),
      },
    ];
  };

  return (
    <div className="space-y-6">
      {/* Hero: today at a glance */}
      <section className="hero-card card-pad animate-fade-up">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="caption">{weekdayCN(data.date)}</p>
            <h1 className="page-title num mt-1">{formatCN(data.date)}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {bestStreak > 0 && (
                <span className="streak-chip num">
                  <Icon name="flame" className="h-3.5 w-3.5" />
                  连续坚持 {bestStreak} 天
                </span>
              )}
              {todoCount > 0 ? (
                <span className="badge-warn">还有 {todoCount} 项待完成</span>
              ) : (
                <span className="badge-success">
                  <Icon name="check" className="h-3 w-3" strokeWidth={2.5} />
                  今天全部完成
                </span>
              )}
            </div>
            <Motivation date={data.date} />
          </div>
          <CompletionRing rate={data.completion_rate} done={data.done_count} total={data.scheduled_count} />
        </div>
      </section>

      {/* Insights */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="今日完成" value={`${data.done_count}/${data.scheduled_count}`} sub={data.scheduled_count ? `${data.completion_rate}%` : "暂无计划"} accent="brand" />
        <StatCard
          label="本周完成率"
          value={week?.completion_rate != null ? `${week.completion_rate}%` : "—"}
          sub={week ? `共 ${week.completed}/${week.expected} 次` : "—"}
        />
        <StatCard label="最长连续" value={`${bestStreak} 天`} accent="flame" sub={bestStreak > 0 ? "保持住！" : "从今天开始"} />
        <StatCard label="本周记录" value={`${week?.total_records ?? 0} 次`} sub="累计打卡" />
      </div>

      {/* Today's habits */}
      <section>
        <SectionTitle
          action={
            <Link to="/habits" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
              管理习惯
            </Link>
          }
        >
          今日习惯
        </SectionTitle>

        {visible.length === 0 && (
          <EmptyState
            icon={<Icon name="sprout" className="h-6 w-6" />}
            title="还没有习惯"
            desc="创建你想坚持的事情：喝水、运动、早睡、阅读…"
            action={
              <Link to="/habits" className="btn-primary btn-sm">
                创建第一个习惯
              </Link>
            }
          />
        )}

        <div className="space-y-2.5">
          {visible.map((item) => {
            const habit = habits.find((h) => h.id === item.habit_id);
            if (!habit) return null;
            const weekly = item.schedule_type === "weekly_count";
            const numeric = item.record_type === "number" || item.record_type === "duration";
            const pct =
              numeric && item.target_value && item.record?.value_number != null
                ? (item.record.value_number / item.target_value) * 100
                : null;
            return (
              <div
                key={item.habit_id}
                {...cardPressProps(item)}
                className={`card flex select-none items-center gap-3.5 p-4 transition-transform duration-150 ease-soft ${
                  pressingId === item.habit_id ? "scale-[0.985] opacity-90" : ""
                }`}
              >
                <button
                  className={item.done_today ? "check-circle-on animate-check-pop" : "check-circle-off"}
                  style={item.done_today ? { backgroundColor: habit.color } : undefined}
                  onClick={() => {
                    if (item.record_type === "boolean" && !item.done_today) void quickCheckin(item);
                    else openRecord(item);
                  }}
                  disabled={savingId === item.habit_id}
                  aria-label={
                    savingId === item.habit_id
                      ? "保存中"
                      : item.done_today
                        ? "修改记录"
                        : item.record_type === "boolean"
                          ? "一键完成"
                          : "完成打卡"
                  }
                >
                  {savingId === item.habit_id ? (
                    "…"
                  ) : item.done_today ? (
                    <Icon name="check" className="h-5 w-5" strokeWidth={2.6} />
                  ) : (
                    <HabitIcon icon={habit.icon} className="h-[22px] w-[22px]" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/habits/${habit.id}`}
                      className={`truncate text-sm font-semibold hover:text-brand-600 dark:hover:text-brand-300 ${
                        item.done_today ? "text-ink-2" : "text-ink"
                      }`}
                    >
                      {item.name}
                    </Link>
                    {item.record?.is_backfilled && (
                      <span className="badge-warn">
                        <Icon name="wrench" className="h-3 w-3" />
                        补签
                      </span>
                    )}
                  </div>
                  <div className="caption mt-1">
                    {weekly
                      ? `本周 ${item.weekly?.this_week_done ?? 0}/${item.weekly?.target ?? 0} 次`
                      : item.done_today
                        ? recordSummary(item) || "已完成"
                        : item.record
                          ? `${recordSummary(item)} · 未达标`
                          : item.scheduled_today
                            ? "今日待完成"
                            : "今天无计划"}
                  </div>
                  {pct != null && (
                    <div className="mt-2 max-w-56">
                      <ProgressBar rate={pct} color={habit.color} />
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {item.current_streak > 0 && (
                    <span className="streak-chip num">
                      <Icon name="flame" className="h-3 w-3" />
                      {item.current_streak} {item.streak_unit === "week" ? "周" : "天"}
                    </span>
                  )}
                  {quickInput?.id === item.habit_id ? (
                    <form
                      className="flex items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void quickSave(item, quickInput.value);
                      }}
                    >
                      <input
                        autoFocus
                        className="input w-24 py-1 text-right text-sm"
                        inputMode="decimal"
                        placeholder={item.unit || "数值"}
                        value={quickInput.value}
                        onChange={(e) => setQuickInput({ id: item.habit_id, value: e.target.value })}
                        onBlur={() => void quickSave(item, quickInput.value)}
                      />
                      <button
                        className="btn-primary btn-sm"
                        type="submit"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        存
                      </button>
                    </form>
                  ) : numeric && !item.done_today ? (
                    <button
                      className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                      onClick={() => void openQuickInput(item)}
                    >
                      快速记录
                    </button>
                  ) : (
                    <button
                      className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                      onClick={() => openRecord(item)}
                    >
                      {item.done_today ? "修改" : "记录"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Journal snapshot */}
      <section className="card card-pad">
        <SectionTitle
          action={
            <Link
              to={`/journal?date=${dateISO}`}
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              {data.journal.has_entry ? "编辑日志" : "写日志"}
            </Link>
          }
        >
          今日状态
        </SectionTitle>
        {data.journal.has_entry ? (
          <div className="space-y-2">
            {(data.journal.mood || data.journal.energy || data.journal.overall) && (
              <div className="flex gap-2">
                {data.journal.mood != null && <span className="badge-brand">心情 {data.journal.mood}/10</span>}
                {data.journal.energy != null && <span className="badge-brand">精力 {data.journal.energy}/10</span>}
                {data.journal.overall != null && <span className="badge-brand">整体 {data.journal.overall}/10</span>}
              </div>
            )}
            {data.journal.text && <p className="text-sm leading-relaxed text-ink-2">“{data.journal.text}”</p>}
          </div>
        ) : (
          <p className="caption">今天还没有记录状态，写一句话鼓励一下自己吧。</p>
        )}
      </section>

      {checkin && (
        <RecordDialog
          habit={checkin.habit}
          recordDate={checkin.date}
          existing={checkin.existing}
          onClose={() => setCheckin(null)}
          onSaved={() => {
            load();
            toast("已保存", "success");
          }}
        />
      )}

      {editing && (
        <HabitForm
          habit={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            toast("已保存", "success");
          }}
          onDeleted={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {menu && (
        <CardMenu x={menu.x} y={menu.y} items={menuItemsFor(menu.habit)} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
