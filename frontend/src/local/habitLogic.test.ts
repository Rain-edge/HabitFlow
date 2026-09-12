// 纯函数测试：跳过日作为连续天数的「桥接」（T1 跳过保护数据层）
import { describe, expect, it } from "vitest";
import { dailyStreaks, scheduledDates, weeklyGoalStreaks } from "./habitLogic";

describe("dailyStreaks 跳过桥接", () => {
  const sched = ["2026-09-01", "2026-09-02", "2026-09-03"];

  it("完成-跳过-完成 算连续 3 天（current 与 longest 均桥接）", () => {
    const [current, longest] = dailyStreaks(
      sched,
      new Set(["2026-09-01", "2026-09-03"]),
      "2026-09-03",
      new Set(["2026-09-02"])
    );
    expect(current).toBe(3);
    expect(longest).toBe(3);
  });

  it("今天标记跳过时计入 current streak（保护不断签）", () => {
    const [current] = dailyStreaks(
      sched,
      new Set(["2026-09-01", "2026-09-02"]),
      "2026-09-03",
      new Set(["2026-09-03"])
    );
    expect(current).toBe(3);
  });

  it("跳过桥接后再次漏卡则从跳过日之后断开", () => {
    // d1 完成、d2 跳过、d3 漏卡 → current 停在 d2
    const [current, longest] = dailyStreaks(
      sched,
      new Set(["2026-09-01"]),
      "2026-09-03",
      new Set(["2026-09-02"])
    );
    expect(current).toBe(2);
    expect(longest).toBe(2);
  });

  it("未记录且未跳过的今天不计入 current（保持既有行为）", () => {
    const [current] = dailyStreaks(sched, new Set(["2026-09-01", "2026-09-02"]), "2026-09-03");
    expect(current).toBe(2);
  });

  it("不传跳过集合时保持原有语义（向后兼容）", () => {
    const [all, longestAll] = dailyStreaks(sched, new Set(sched), "2026-09-03");
    expect(all).toBe(3);
    expect(longestAll).toBe(3);
    const [broken, longestBroken] = dailyStreaks(sched, new Set(["2026-09-01", "2026-09-03"]), "2026-09-03");
    expect(broken).toBe(1);
    expect(longestBroken).toBe(1);
  });
});

describe("weeklyGoalStreaks 与跳过无关", () => {
  it("按周计数，不读取跳过集合", () => {
    const [current, longest, weeksTotal, weeksMet] = weeklyGoalStreaks(
      "2026-08-31",
      "2026-09-13",
      3,
      new Set(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-07", "2026-09-08", "2026-09-09"])
    );
    expect(weeksTotal).toBe(2);
    expect(weeksMet).toBe(2);
    expect(current).toBe(2);
    expect(longest).toBe(2);
  });
});

describe("scheduledDates 回归", () => {
  it("每日习惯按日生成到 today 为止", () => {
    const out = scheduledDates("2026-09-01", "2026-09-03", "daily");
    expect(out).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("weekly_days 只生成指定星期（周一=0/周四=3）——防 `in` 误用回归", () => {
    // 2026-09-07 是周一；窗口内应只有周一(0)与周四(3)
    const out = scheduledDates("2026-09-07", "2026-09-13", "weekly_days", [0, 3]);
    expect(out).toEqual(["2026-09-07", "2026-09-10"]);
  });
});
