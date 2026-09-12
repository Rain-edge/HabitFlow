import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Habit, RecordType, ScheduleType } from "../types";
import { todayISO } from "../utils/date";
import ConfirmDialog from "./ConfirmDialog";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import Modal from "./Modal";
import { toast } from "./Layout";

const ICONS: IconName[] = [
  "sprout", "droplets", "footprints", "book-open", "moon", "smile",
  "utensils", "flower", "pen-line", "dumbbell", "target", "sun",
  "heart-pulse", "coffee", "music", "alarm-clock",
];
// Low-saturation, calm palette — teal / blue / violet family with two warm accents.
const COLORS = ["#18A396", "#5B8DEF", "#8B7CF6", "#4FA8C9", "#6FA88F", "#E89B5B", "#D98BA0", "#7C8FA6"];
const WEEKDAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

const RECORD_TYPES: { value: RecordType; label: string; desc: string }[] = [
  { value: "boolean", label: "完成 / 未完成", desc: "今天做了吗？" },
  { value: "number", label: "数值", desc: "如喝水 2000 ml" },
  { value: "duration", label: "时长", desc: "如运动 30 分钟" },
  { value: "rating", label: "评分 1-10", desc: "如心情打分" },
  { value: "select", label: "单选项", desc: "很好 / 不错 / 一般…" },
  { value: "text", label: "文字", desc: "写一句话记录" },
  { value: "time", label: "时间点", desc: "如几点睡觉" },
];

interface Props {
  habit?: Habit;
  onClose: () => void;
  onSaved: () => void;
  /** Called instead of onSaved after a delete, so callers can toast correctly. */
  onDeleted?: () => void;
}

export default function HabitForm({ habit, onClose, onSaved, onDeleted }: Props) {
  const isEdit = !!habit;
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "sprout");
  const [color, setColor] = useState(habit?.color ?? "#18A396");
  const [category, setCategory] = useState(habit?.category ?? "日常");
  const [recordType, setRecordType] = useState<RecordType>(habit?.record_type ?? "boolean");
  const [targetValue, setTargetValue] = useState(habit?.target_value?.toString() ?? "");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [selectOptions, setSelectOptions] = useState((habit?.select_options ?? []).join("\n"));
  const [scheduleType, setScheduleType] = useState<ScheduleType>(habit?.schedule_type ?? "daily");
  const [weeklyTarget, setWeeklyTarget] = useState(habit?.weekly_target?.toString() ?? "3");
  const [weeklyDays, setWeeklyDays] = useState<number[]>(habit?.weekly_days ?? [0, 2, 4]);
  const [startDate, setStartDate] = useState(habit?.start_date ?? todayISO());
  const [endDate, setEndDate] = useState(habit?.end_date ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(habit?.reminder_enabled ?? false);
  const [reminderTime, setReminderTime] = useState(habit?.reminder_time ?? "20:00");
  const isActive = habit?.is_active ?? true;
  const [showOnHomepage, setShowOnHomepage] = useState(habit?.show_on_homepage ?? true);
  const [countsForDaily, setCountsForDaily] = useState(habit?.counts_for_daily ?? true);
  const [allowBackfill, setAllowBackfill] = useState(habit?.allow_backfill ?? true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const needTarget = recordType === "number" || recordType === "duration";

  // datalist 联想选项：既有习惯的去重非空分类（拉取失败静默降级为无联想）
  const [knownCategories, setKnownCategories] = useState<string[]>([]);
  useEffect(() => {
    api
      .get<Habit[]>("/habits")
      .then((list) =>
        setKnownCategories(
          [...new Set(list.filter((h) => h.category && h.category !== "general").map((h) => h.category))].sort()
        )
      )
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!name.trim()) {
      toast("请填写习惯名称", "error");
      return;
    }
    setSaving(true);
    try {
      const base: Record<string, unknown> = {
        name: name.trim(),
        description: description || null,
        icon,
        color,
        category: category.trim() || "日常",
        record_type: recordType,
        target_value: targetValue === "" ? null : Number(targetValue),
        unit: unit || null,
        select_options: recordType === "select" ? selectOptions.split("\n").map((s) => s.trim()).filter(Boolean) : null,
        schedule_type: scheduleType,
        weekly_target: scheduleType === "weekly_count" ? Number(weeklyTarget) : null,
        weekly_days: scheduleType === "weekly_days" ? weeklyDays : null,
        reminder_enabled: reminderEnabled,
        reminder_time: reminderEnabled ? reminderTime : null,
        show_on_homepage: showOnHomepage,
        is_active: isActive,
        counts_for_daily: countsForDaily,
        allow_backfill: allowBackfill,
        end_date: endDate || null,
      };
      if (isEdit) {
        await api.put(`/habits/${habit!.id}`, base);
      } else {
        await api.post("/habits", { ...base, start_date: startDate });
      }
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "编辑习惯" : "新建习惯"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="label">名称</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：坚持喝水" />
          </div>
        </div>

        <div>
          <label className="label">图标</label>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
                  icon === i
                    ? "bg-brand-600 text-white"
                    : "text-ink-2 hover:bg-line-2 hover:text-ink"
                }`}
                onClick={() => setIcon(i)}
                aria-label={i}
              >
                <Icon name={i} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">颜色</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-ink ring-offset-2" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">分类</label>
            <input
              className="input"
              list="habit-category-options"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="健康 / 学习 / 作息"
            />
            <datalist id="habit-category-options">
              {knownCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">描述（可选）</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">记录类型</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {RECORD_TYPES.map((t) => (
              <button
                key={t.value}
                className={`rounded-lg border p-2 text-left ${
                  recordType === t.value ? "border-brand-500 bg-brand-500/10" : "border-line hover:bg-line-2"
                }`}
                onClick={() => setRecordType(t.value)}
              >
                <div className="text-sm font-medium text-ink">{t.label}</div>
                <div className="text-[11px] text-ink-3">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {needTarget && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">目标值</label>
              <input className="input" type="number" min="0" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="如 2000" />
            </div>
            <div>
              <label className="label">单位</label>
              <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ml / 分钟" />
            </div>
          </div>
        )}

        {recordType === "rating" && (
          <p className="text-xs text-ink-3">记录 1-10 的评分，记录即视为完成。</p>
        )}

        {recordType === "select" && (
          <div>
            <label className="label">选项（每行一个）</label>
            <textarea
              className="input min-h-20"
              value={selectOptions}
              onChange={(e) => setSelectOptions(e.target.value)}
              placeholder={"很好\n不错\n一般"}
            />
          </div>
        )}

        <div>
          <label className="label">执行规则</label>
          <div className="flex gap-2">
            {(
              [
                { v: "daily", label: "每天" },
                { v: "weekly_count", label: "每周 N 次" },
                { v: "weekly_days", label: "每周指定日" },
              ] as { v: ScheduleType; label: string }[]
            ).map((o) => (
              <button
                key={o.v}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  scheduleType === o.v ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-line text-ink-2"
                }`}
                onClick={() => setScheduleType(o.v)}
              >
                {o.label}
              </button>
            ))}
          </div>

          {scheduleType === "weekly_count" && (
            <div className="mt-2 flex items-center gap-2 text-sm text-ink-2">
              每周完成
              <input className="input w-16 text-center" type="number" min="1" max="7" value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} />
              次
            </div>
          )}
          {scheduleType === "weekly_days" && (
            <div className="mt-2 flex gap-1.5">
              {WEEKDAY_NAMES.map((w, i) => (
                <button
                  key={i}
                  className={`h-9 w-9 rounded-full text-sm ${
                    weeklyDays.includes(i) ? "bg-brand-600 text-white" : "bg-line-2 text-ink-2"
                  }`}
                  onClick={() =>
                    setWeeklyDays((days) => (days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort()))
                  }
                >
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div>
              <label className="label">开始日期</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">结束日期（可选）</label>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-card-2 p-3 text-sm text-ink-2">
          <label className="flex items-center justify-between">
            <span>每日提醒</span>
            <span className="flex items-center gap-2">
              {reminderEnabled && (
                <input className="input w-28" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
              )}
              <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
            </span>
          </label>
          <label className="flex items-center justify-between">
            <span>显示在首页</span>
            <input type="checkbox" checked={showOnHomepage} onChange={(e) => setShowOnHomepage(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between">
            <span>参与每日完成度</span>
            <input type="checkbox" checked={countsForDaily} onChange={(e) => setCountsForDaily(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between">
            <span>允许补签历史</span>
            <input type="checkbox" checked={allowBackfill} onChange={(e) => setAllowBackfill(e.target.checked)} />
          </label>
        </div>

        <div className={`flex items-center gap-2 pt-2 ${isEdit ? "justify-between" : "justify-end"}`}>
          {isEdit && (
            <button
              className="btn-ghost text-danger-500 hover:bg-danger-500/10 hover:text-danger-600"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              删除习惯
            </button>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>
              取消
            </button>
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? "保存中…" : isEdit ? "保存修改" : "创建习惯"}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`删除「${habit!.name}」？`}
          description="历史记录会保留并继续参与统计，习惯可随时恢复。"
          confirmLabel="删除"
          danger
          onConfirm={() => {
            void (async () => {
              try {
                await api.delete(`/habits/${habit!.id}`);
                toast("已删除，历史保留", "info");
                if (onDeleted) onDeleted();
                else onSaved();
                onClose();
              } catch (e) {
                toast((e as Error).message, "error");
              }
            })();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}
