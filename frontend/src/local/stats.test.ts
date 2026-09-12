// 纯函数测试：跳过日的统计口径（T1 跳过保护数据层）
// 只覆盖不依赖 IndexedDB 的纯计算入口 computeHabitStats。
import { describe, expect, it } from "vitest";
import { computeHabitStats } from "./stats";
import { StoredHabit } from "./db";

function makeHabit(overrides: Partial<StoredHabit> = {}): StoredHabit {
  return {
    id: 1,
    name: "测试习惯",
    description: null,
    icon: "check",
    color: "#4FA8C9",
    category: "测试",
    record_type: "boolean",
    target_value: null,
    unit: null,
    select_options: null,
    schedule_type: "daily",
    weekly_target: null,
    weekly_days: null,
    start_date: "2026-09-07",
    end_date: null,
    reminder_time: null,
    reminder_enabled: false,
    is_active: true,
    show_on_homepage: true,
    counts_for_daily: true,
    allow_backfill: true,
    created_at: "2026-09-07",
    deleted_at: null,
    ...overrides,
  };
}

describe("computeHabitStats 跳过口径（daily）", () => {
  const today = "2026-09-11";

  it("跳过日从 expected 分母剔除，完成率只反映真实执行", () => {
    // 09-07~09-11 共 5 个应完成日，跳过 09-09 → 分母 4
    const completed = new Set(["2026-09-07", "2026-09-08", "2026-09-10", "2026-09-11"]);
    const skipped = new Set(["2026-09-09"]);
    const s = computeHabitStats(makeHabit(), completed, today, skipped);
    expect(s.expected_total).toBe(4);
    expect(s.completion_rate).toBe(100);
    expect(s.last_7_days.expected).toBe(4);
    expect(s.last_7_days.completed).toBe(4);
    expect(s.this_week.expected).toBe(4);
  });

  it("跳过日桥接 streak：完成-跳过-完成 连续不断", () => {
    const completed = new Set(["2026-09-07", "2026-09-08", "2026-09-10", "2026-09-11"]);
    const skipped = new Set(["2026-09-09"]);
    const s = computeHabitStats(makeHabit(), completed, today, skipped);
    expect(s.current_streak).toBe(5);
    expect(s.longest_streak).toBe(5);
  });

  it("跳过日未完成也不算漏卡：分母剔除后 done === expected 即 full", () => {
    // 只完成 09-07，其余全跳过（除 09-10 漏卡）
    const completed = new Set(["2026-09-07"]);
    const skipped = new Set(["2026-09-08", "2026-09-09", "2026-09-11"]);
    const s = computeHabitStats(makeHabit(), completed, today, skipped);
    expect(s.expected_total).toBe(2); // 07、10 两个真实应完成日
    expect(s.completion_rate).toBe(50);
    expect(s.current_streak).toBe(1); // 今天的跳过自身计 1，但桥接不了之前的漏卡
  });

  it("不传跳过集合时与旧行为一致", () => {
    const completed = new Set(["2026-09-07", "2026-09-08"]);
    const s = computeHabitStats(makeHabit(), completed, today);
    expect(s.expected_total).toBe(5);
    expect(s.completion_rate).toBe(40);
    expect(s.current_streak).toBe(0); // 今天未打卡
    expect(s.longest_streak).toBe(2);
  });
});

describe("computeHabitStats weekly_days 口径", () => {
  it("周一/周四习惯：跳过日剔除分母且桥接 streak", () => {
    const h = makeHabit({
      schedule_type: "weekly_days",
      weekly_days: [0, 3], // 周一(0)、周四(3)
      start_date: "2026-09-07", // 周一
    });
    // 应完成日：09-07(一)、09-10(四)
    const completed = new Set(["2026-09-07"]);
    const skipped = new Set(["2026-09-10"]); // 周四跳过
    const s = computeHabitStats(h, completed, "2026-09-13", skipped);
    expect(s.expected_total).toBe(1); // 分母只剩 09-07
    expect(s.completion_rate).toBe(100);
    expect(s.current_streak).toBe(2); // 完成-跳过 桥接
    expect(s.longest_streak).toBe(2);
  });
});

describe("computeHabitStats weekly_count 不受跳过影响", () => {
  it("周目标按周计数，跳过集合被忽略", () => {
    const h = makeHabit({
      schedule_type: "weekly_count",
      weekly_target: 2,
      start_date: "2026-08-31",
    });
    const completed = new Set(["2026-09-01", "2026-09-02"]); // 第一周达标
    const skipped = new Set(["2026-09-08"]); // weekly_count 无跳过概念
    const s = computeHabitStats(h, completed, "2026-09-13", skipped);
    expect(s.weekly?.weeks_total).toBe(2);
    expect(s.weekly?.weeks_met).toBe(1);
    expect(s.expected_total).toBe(4); // 2 周 × 每周 2 次
    expect(s.completion_rate).toBe(50);
    expect(s.current_streak).toBe(1); // 本周未达标，仅上周连续
  });
});
