import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Habit } from "../types";
import Modal from "./Modal";
import { toast } from "./Layout";

export interface ExistingRecord {
  id: number;
  value_number: number | null;
  value_text: string | null;
  value_time: string | null;
  note: string | null;
  is_backfilled: boolean;
}

interface Props {
  habit: Habit;
  recordDate: string;
  existing?: ExistingRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function RecordDialog({ habit, recordDate, existing, onClose, onSaved }: Props) {
  const [valueNumber, setValueNumber] = useState<string>(existing?.value_number?.toString() ?? "");
  const [valueText, setValueText] = useState<string>(existing?.value_text ?? "");
  const [valueTime, setValueTime] = useState<string>(existing?.value_time ?? "");
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [uncheck, setUncheck] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setValueNumber(existing?.value_number?.toString() ?? "");
    setValueText(existing?.value_text ?? "");
    setValueTime(existing?.value_time ?? "");
    setNote(existing?.note ?? "");
    setUncheck(false);
  }, [existing, habit.id, recordDate]);

  const isEdit = !!existing;
  const title = `${habit.name} · ${recordDate}${existing?.is_backfilled ? "（补签）" : ""}`;

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { note: note || null };
      if (habit.record_type === "boolean") {
        payload.is_completed = !uncheck;
      } else if (habit.record_type === "number" || habit.record_type === "duration" || habit.record_type === "rating") {
        payload.value_number = valueNumber === "" ? null : Number(valueNumber);
      } else if (habit.record_type === "select" || habit.record_type === "text") {
        payload.value_text = valueText || null;
      } else if (habit.record_type === "time") {
        payload.value_time = valueTime || null;
      }

      if (isEdit) {
        await api.put(`/records/${existing!.id}`, payload);
      } else {
        await api.post("/records", { ...payload, habit_id: habit.id, record_date: recordDate });
      }
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    await api.delete(`/records/${existing.id}`);
    onSaved();
    onClose();
  };

  return (
    <Modal title={isEdit ? `编辑记录 · ${title}` : `记录 · ${title}`} onClose={onClose}>
      <div className="space-y-4">
        {habit.record_type === "boolean" && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={!uncheck} onChange={(e) => setUncheck(!e.target.checked)} />
            今天完成了「{habit.name}」
          </label>
        )}

        {(habit.record_type === "number" || habit.record_type === "duration") && (
          <div>
            <label className="label">
              {habit.record_type === "number" ? "数值" : "时长"}
              {habit.target_value != null && `（目标 ${habit.target_value}${habit.unit ? " " + habit.unit : ""}）`}
            </label>
            <input
              className="input"
              type="number"
              min="0"
              value={valueNumber}
              onChange={(e) => setValueNumber(e.target.value)}
              placeholder={habit.unit || ""}
            />
          </div>
        )}

        {habit.record_type === "rating" && (
          <div>
            <label className="label">评分（1 - 10）</label>
            <input
              className="input"
              type="range"
              min="1"
              max="10"
              value={valueNumber === "" ? 5 : Number(valueNumber)}
              onChange={(e) => setValueNumber(e.target.value)}
            />
            <div className="mt-1 text-center text-sm font-semibold text-brand-600">
              {valueNumber === "" ? 5 : valueNumber} 分
            </div>
          </div>
        )}

        {habit.record_type === "select" && (
          <div className="flex flex-wrap gap-2">
            {(habit.select_options || []).map((opt) => (
              <button
                key={opt}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  valueText === opt
                    ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                    : "border-line text-ink-2 hover:bg-line-2"
                }`}
                onClick={() => setValueText(opt === valueText ? "" : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {habit.record_type === "text" && (
          <textarea
            className="input min-h-24"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            placeholder="写点什么…"
          />
        )}

        {habit.record_type === "time" && (
          <div>
            <label className="label">时间</label>
            <input className="input" type="time" value={valueTime} onChange={(e) => setValueTime(e.target.value)} />
          </div>
        )}

        <div>
          <label className="label">备注（可选）</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
        </div>

        <div className="flex justify-between pt-2">
          {isEdit ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-3">删除后该日期可重新记录</span>
                <button className="rounded-md bg-danger-500/10 px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-500/15" onClick={remove}>
                  确认删除
                </button>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirmingDelete(false)}>
                  取消
                </button>
              </div>
            ) : (
              <button className="rounded-md px-3 py-2 text-sm font-medium text-danger-500 hover:bg-danger-500/10" onClick={() => setConfirmingDelete(true)}>
                删除记录
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>
              取消
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "保存中…" : isEdit ? "保存修改" : "完成记录"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
