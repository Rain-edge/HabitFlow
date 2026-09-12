import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import HabitForm from "../components/HabitForm";
import HabitIcon from "../components/HabitIcon";
import Icon from "../components/Icon";
import { toast } from "../components/Layout";
import { EmptyState } from "../components/ui";
import type { Habit } from "../types";
import { scheduleLabel } from "../utils/schedule";

const TYPE_LABEL: Record<string, string> = {
  boolean: "完成",
  number: "数值",
  duration: "时长",
  rating: "评分",
  select: "单选",
  text: "文字",
  time: "时间",
};

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Habit | undefined>();
  const [showDeleted, setShowDeleted] = useState(false);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "name" | "newest">("default");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(undefined);
      setShowForm(true);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    const list = await api.get<Habit[]>("/habits?include_deleted=true");
    setHabits(list);
  }, []);

  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, [load]);

  const filtered = (showDeleted ? habits : habits.filter((h) => !h.deleted_at)).filter((h) => {
    if (catFilter && h.category !== catFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${h.name} ${h.description ?? ""} ${h.icon} ${h.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const visible = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "zh");
    if (sortBy === "newest") return (b.created_at || "").localeCompare(a.created_at || "");
    return 0;
  });
  const hasDeleted = habits.some((h) => h.deleted_at);
  const categories = [...new Set(habits.filter((h) => h.category && h.category !== "general").map((h) => h.category))].sort();

  const restore = async (h: Habit) => {
    await api.post(`/habits/${h.id}/restore`);
    toast("已恢复", "success");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">我的习惯</h1>
        <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true); }}>
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
          新建习惯
        </button>
      </div>

      {hasDeleted && (
        <label className="flex items-center gap-2 text-xs text-ink-2">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          显示已删除的习惯
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input min-w-0 flex-1 sm:max-w-xs"
          placeholder="搜索习惯…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索习惯"
        />
        <select
          className="input w-auto"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "default" | "name" | "newest")}
          aria-label="排序方式"
        >
          <option value="default">默认排序</option>
          <option value="name">按名称</option>
          <option value="newest">最近创建</option>
        </select>
        {categories.length > 0 && (
          <select
            className="input w-auto"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="按分类筛选"
          >
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 && (
        <div className="card">
          {query || catFilter ? (
            <EmptyState
              icon={<Icon name="search" className="h-5 w-5" />}
              title="没有匹配的习惯"
              desc="换个关键词或分类试试。"
            />
          ) : (
            <EmptyState
              icon={<Icon name="sprout" className="h-6 w-6" />}
              title="还没有习惯"
              desc="创建你想坚持的事情：喝水、运动、早睡、阅读…"
              action={
                <button
                  className="btn-primary btn-sm"
                  onClick={() => {
                    setEditing(undefined);
                    setShowForm(true);
                  }}
                >
                  新建习惯
                </button>
              }
            />
          )}
        </div>
      )}

      <div className="space-y-2.5">
        {visible.map((h) => (
          <div key={h.id} className={`card p-4 ${h.deleted_at ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <Link to={`/habits/${h.id}`} className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${h.color}2E` }}
                >
                  <HabitIcon icon={h.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{h.name}</span>
                    {h.deleted_at && <span className="rounded bg-line-2 px-1.5 text-[10px] text-ink-3">已删除</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {TYPE_LABEL[h.record_type]} · {scheduleLabel(h)}
                    {h.target_value != null && ` · 目标 ${h.target_value}${h.unit ? ` ${h.unit}` : ""}`}
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 gap-1">
                {h.deleted_at ? (
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => restore(h)}>
                    恢复
                  </button>
                ) : (
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => { setEditing(h); setShowForm(true); }}
                  >
                    编辑
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <HabitForm
          habit={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            load();
            toast(editing ? "已保存" : "习惯已创建", "success");
          }}
          onDeleted={() => void load()}
        />
      )}
    </div>
  );
}
