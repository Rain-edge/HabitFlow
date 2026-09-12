// Bookkeeping page: month summary, category pie (expense/income), day-grouped ledger.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../api/client";
import type { StoredTransaction, StoredCategory } from "../local/db";
import { EmptyState } from "../components/ui";
import HabitIcon from "../components/HabitIcon";
import Icon from "../components/Icon";
import TxSheet, { formatAmount } from "../components/TxSheet";
import { toast } from "../components/Layout";
import { todayISO, weekdayCN } from "../utils/date";

interface MonthSummary {
  income: number;
  expense: number;
}

const MONTHS_CN = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Bookkeeping() {
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [txs, setTxs] = useState<StoredTransaction[]>([]);
  const [cats, setCats] = useState<StoredCategory[]>([]);
  const [summary, setSummary] = useState<MonthSummary>({ income: 0, expense: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTx, setEditTx] = useState<StoredTransaction | null>(null);
  const [pieType, setPieType] = useState<"expense" | "income">("expense");
  const [loading, setLoading] = useState(true);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [txRows, catRows] = await Promise.all([
        api.get<StoredTransaction[]>(`/transactions?month=${month}`),
        api.get<StoredCategory[]>("/categories"),
      ]);
      if (seq !== loadSeq.current) return; // a newer load (month switch) superseded us
      setTxs(txRows);
      setCats(catRows);
      let income = 0;
      let expense = 0;
      for (const t of txRows) {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
      }
      setSummary({ income, expense });
    } catch {
      if (seq === loadSeq.current) toast("加载失败", "error");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  // Day-grouped ledger, newest day first (list is already sorted).
  const groups = useMemo(() => {
    const byDate = new Map<string, StoredTransaction[]>();
    for (const t of txs) {
      const arr = byDate.get(t.tx_date);
      if (arr) arr.push(t);
      else byDate.set(t.tx_date, [t]);
    }
    return [...byDate.entries()];
  }, [txs]);

  // Category totals for the pie chart.
  const pieData = useMemo(() => {
    const totals = new Map<number, number>();
    for (const t of txs) {
      if (t.type !== pieType) continue;
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount);
    }
    return [...totals.entries()]
      .map(([id, total]) => {
        const c = catById.get(id);
        return {
          id,
          name: c?.name ?? "其他",
          color: c?.color ?? "#7C8FA6",
          icon: c?.icon ?? "more",
          value: total / 100,
          cents: total,
        };
      })
      .sort((a, b) => b.cents - a.cents);
  }, [txs, pieType, catById]);

  const pieTotal = pieData.reduce((s, d) => s + d.cents, 0);
  const currentMonthLabel = `${month.slice(0, 4)}年${MONTHS_CN[Number(month.slice(5, 7)) - 1]}`;
  const isCurrentMonth = month === todayISO().slice(0, 7);

  const openAdd = () => {
    setEditTx(null);
    setSheetOpen(true);
  };

  const openEdit = (t: StoredTransaction) => {
    setEditTx(t);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">记账</h1>
        <button className="btn btn-md btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
          记一笔
        </button>
      </div>

      {/* Month switch + totals */}
      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <button
            className="icon-btn"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="上一月"
          >
            <Icon name="prev" className="h-4 w-4" />
          </button>
          <span className="num font-display text-sm font-semibold text-ink">
            {currentMonthLabel}
            {!isCurrentMonth && (
              <button className="ml-2 text-xs font-normal text-brand-600 hover:underline" onClick={() => setMonth(todayISO().slice(0, 7))}>
                回本月
              </button>
            )}
          </span>
          <button
            className="icon-btn"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="下一月"
            disabled={isCurrentMonth}
          >
            <Icon name="next" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="caption">本月支出</div>
            <div className="num mt-1 font-display text-xl font-bold text-flame-500">¥{formatAmount(summary.expense)}</div>
          </div>
          <div>
            <div className="caption">本月收入</div>
            <div className="num mt-1 font-display text-xl font-bold text-success-500">¥{formatAmount(summary.income)}</div>
          </div>
          <div>
            <div className="caption">结余</div>
            <div className="num mt-1 font-display text-xl font-bold text-ink">
              ¥{formatAmount(summary.income - summary.expense)}
            </div>
          </div>
        </div>
      </div>

      {/* Category pie */}
      {pieData.length > 0 && (
        <div className="card card-pad">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title mb-0">分类占比</h2>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-line-2 p-0.5 text-xs">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPieType(t)}
                  className={`rounded-md px-3 py-1 font-medium transition ${
                    pieType === t ? "bg-card text-ink shadow-sm" : "text-ink-3"
                  }`}
                >
                  {t === "expense" ? "支出" : "收入"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.id} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string, name: string) => [`¥${Number(value).toFixed(2)}`, name]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      background: "var(--card)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {pieData.slice(0, 6).map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{d.name}</span>
                  <span className="num shrink-0 text-ink">¥{formatAmount(d.cents)}</span>
                  <span className="num w-10 shrink-0 text-right text-ink-3">
                    {Math.round((d.cents / pieTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ledger */}
      {!loading && txs.length === 0 && (
        <EmptyState
          icon={<Icon name="wallet" className="h-6 w-6" />}
          title={isCurrentMonth ? "这个月还没有记过一笔" : "该月没有记录"}
          desc="点「记一笔」，3 秒完成：输金额、点分类、保存。"
          action={
            <button className="btn btn-md btn-primary" onClick={openAdd}>
              记一笔
            </button>
          }
        />
      )}

      {groups.map(([date, items]) => {
        let dayExpense = 0;
        let dayIncome = 0;
        for (const t of items) {
          if (t.type === "expense") dayExpense += t.amount;
          else dayIncome += t.amount;
        }
        return (
          <div key={date} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <span className="num text-xs font-semibold text-ink-2">
                {date.slice(5, 7)}月{Number(date.slice(8, 10))}日 · {weekdayCN(date)}
                {date === todayISO() && <span className="ml-1.5 text-brand-600">今天</span>}
              </span>
              <span className="num text-xs text-ink-3">
                {dayExpense > 0 && <span className="text-flame-500">支出 ¥{formatAmount(dayExpense)}</span>}
                {dayExpense > 0 && dayIncome > 0 && " · "}
                {dayIncome > 0 && <span className="text-success-500">收入 ¥{formatAmount(dayIncome)}</span>}
              </span>
            </div>
            <div className="divide-y divide-line">
              {items.map((t) => {
                const c = catById.get(t.category_id);
                return (
                  <button
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-line-2"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${c?.color ?? "#7C8FA6"}26`, color: c?.color ?? "#7C8FA6" }}
                    >
                      <HabitIcon icon={c?.icon ?? "more"} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{c?.name ?? "其他"}</span>
                      {t.note && <span className="block truncate text-xs text-ink-3">{t.note}</span>}
                    </span>
                    <span
                      className={`num shrink-0 font-display text-sm font-semibold ${
                        t.type === "expense" ? "text-ink" : "text-success-500"
                      }`}
                    >
                      {t.type === "expense" ? "-" : "+"}
                      {formatAmount(t.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <TxSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => void load()}
        editTx={editTx}
      />
    </div>
  );
}
