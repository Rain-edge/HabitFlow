// Add/edit a bookkeeping entry. Bottom sheet with a numeric keypad so a
// single entry (amount + category + optional note) takes ~3 seconds.
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { todayISO } from "../utils/date";
import type { StoredTransaction, StoredCategory, TxType } from "../local/db";
import ConfirmDialog from "./ConfirmDialog";
import HabitIcon from "./HabitIcon";
import Modal from "./Modal";
import { toast } from "./Layout";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

/** "12.5" -> 1250 cents; returns null when the input is not a positive amount. */
function toCents(s: string): number | null {
  const n = Number.parseFloat(s);
  if (!s || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TxSheet({
  open,
  onClose,
  onSaved,
  editTx,
  defaultType = "expense",
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editTx?: StoredTransaction | null;
  defaultType?: TxType;
}) {
  const [type, setType] = useState<TxType>(defaultType);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [categories, setCategories] = useState<StoredCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = editTx != null;

  // Fresh state each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (editTx) {
      setType(editTx.type);
      setAmount((editTx.amount / 100).toString());
      setCategoryId(editTx.category_id);
      setNote(editTx.note ?? "");
      setDate(editTx.tx_date);
    } else {
      setType(defaultType);
      setAmount("");
      setCategoryId(null);
      setNote("");
      setDate(todayISO());
    }
  }, [open, editTx, defaultType]);

  useEffect(() => {
    if (!open) return;
    void api
      .get<StoredCategory[]>(`/categories?type=${type}`)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open, type]);

  // Keep a valid selection when the category list changes (e.g. switching type).
  useEffect(() => {
    if (categoryId == null || !isEdit) return;
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(null);
  }, [categories, categoryId, isEdit]);

  const press = (k: string) => {
    setAmount((s) => {
      if (k === "del") return s.slice(0, -1);
      if (k === ".") return s.includes(".") ? s : s === "" ? "0." : s + ".";
      const [int, dec] = s.split(".");
      if (dec !== undefined) return dec.length >= 2 ? s : s + k;
      if (int.length >= 8) return s;
      return s === "0" ? k : s + k;
    });
  };

  const save = async () => {
    const cents = toCents(amount);
    if (cents == null) {
      toast("请输入金额", "error");
      return;
    }
    if (categoryId == null) {
      toast("请选择分类", "error");
      return;
    }
    setSaving(true);
    try {
      const body = { type, amount: cents, category_id: categoryId, note: note || null, tx_date: date };
      if (isEdit && editTx) await api.put(`/transactions/${editTx.id}`, body);
      else await api.post("/transactions", body);
      toast(isEdit ? "已更新" : "已记一笔", "success");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editTx) return;
    setSaving(true);
    try {
      await api.delete(`/transactions/${editTx.id}`);
      toast("已删除", "success");
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "删除失败", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal title={isEdit ? "编辑记录" : "记一笔"} onClose={onClose}>
      <div className="space-y-4">
        {/* expense / income switch */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-line-2 p-1">
          {(["expense", "income"] as TxType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setCategoryId(null);
              }}
              className={`rounded-md py-1.5 text-sm font-medium transition ${
                type === t
                  ? t === "expense"
                    ? "bg-flame-500/15 text-flame-600 dark:text-flame-500"
                    : "bg-success-500/15 text-success-600 dark:text-success-500"
                  : "text-ink-2"
              }`}
            >
              {t === "expense" ? "支出" : "收入"}
            </button>
          ))}
        </div>

        {/* amount display */}
        <div className="flex items-baseline justify-end gap-1 rounded-lg bg-line-2 px-4 py-3">
          <span className="text-sm text-ink-3">¥</span>
          <span className="num font-display text-3xl font-bold tracking-tight text-ink">
            {amount === "" ? "0" : amount}
          </span>
        </div>

        {/* category grid */}
        <div className="grid grid-cols-4 gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition ${
                categoryId === c.id ? "border-brand-500 bg-brand-500/10" : "border-line hover:bg-line-2"
              }`}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${c.color}26`, color: c.color }}
              >
                <HabitIcon icon={c.icon} className="h-4 w-4" />
              </span>
              <span className={`text-xs ${categoryId === c.id ? "font-medium text-ink" : "text-ink-2"}`}>{c.name}</span>
            </button>
          ))}
        </div>

        {/* note + date */}
        <div className="flex gap-2">
          <input
            className="input min-w-0 flex-1"
            placeholder="备注（可选）"
            maxLength={30}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <input
            className="input w-36 shrink-0"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* numeric keypad */}
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className="num rounded-xl border border-line py-3 font-display text-lg font-semibold text-ink transition hover:bg-line-2 active:bg-brand-500/10"
              aria-label={k === "del" ? "退格" : k}
            >
              {k === "del" ? "⌫" : k}
            </button>
          ))}
        </div>

        <div className={`flex gap-2 ${isEdit ? "" : "hidden"}`}>
          <button className="btn btn-lg btn-danger flex-1" disabled={saving} onClick={() => setConfirmDelete(true)}>
            删除
          </button>
          <button className="btn btn-lg btn-primary flex-[2]" disabled={saving} onClick={save}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
        {!isEdit && (
          <button className="btn btn-lg btn-primary w-full" disabled={saving} onClick={save}>
            {saving ? "保存中…" : "保存"}
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="删除这条记录？"
          description="删除后本月汇总与分类统计将同步更新。"
          confirmLabel="删除"
          danger
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}

export { formatAmount };
