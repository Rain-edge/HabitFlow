// 纯函数测试：跳过日作为连续天数的「桥接」（T1 跳过保护数据层）
// 语义（2026-09-12 用户拍板）：跳过只防中断不涨天数——
//  - longest：段内跳过日照常计入段长，但整段须含至少一个真实完成日（纯跳过段计 0）
//  - current：从今天往回走，跳过日不断开也不涨数字
import { describe, expect, it } from "vitest";
import { dailyStreaks, resolveRecordUpdate, scheduledDates, weeklyGoalStreaks } from "./habitLogic";

describe("dailyStreaks 跳过桥接", () => {
  const sched = ["2026-09-01", "2026-09-02", "2026-09-03"];

  it("完成-跳过-完成：段长含跳过计 3（longest），current 只数真实完成 2", () => {
    const [current, longest] = dailyStreaks(
      sched,
      new Set(["2026-09-01", "2026-09-03"]),
      "2026-09-03",
      new Set(["2026-09-02"])
    );
    expect(current).toBe(2);
    expect(longest).toBe(3);
  });

  it("今天跳过保持连续不中断，但不涨数字（[done,done,skip(今天)] → current 2）", () => {
    const [current] = dailyStreaks(
      sched,
      new Set(["2026-09-01", "2026-09-02"]),
      "2026-09-03",
      new Set(["2026-09-03"])
    );
    expect(current).toBe(2); // 两天真实完成，今天跳过不 +1
  });

  it("纯跳过段计 0：零完成连跳攒不出 streak（含 longest）", () => {
    const [current, longest] = dailyStreaks(
      sched,
      new Set(),
      "2026-09-03",
      new Set(sched)
    );
    expect(current).toBe(0);
    expect(longest).toBe(0);
  });

  it("完成日后接跳过属同一连续段，longest 计入段长（[done, skip] → longest 2）", () => {
    const [current, longest] = dailyStreaks(
      sched,
      new Set(["2026-09-01"]),
      "2026-09-03",
      new Set(["2026-09-02"])
    );
    expect(current).toBe(1);
    expect(longest).toBe(2);
  });

  it("跳过桥接后真实漏卡则断开（漏卡日之后的完成重新起段）", () => {
    // d1 完成、d2 跳过、d3 漏卡、d4(today) 完成 → current 只数 d4，longest 取 [d1,d2] 段
    const sched4 = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
    const [current, longest] = dailyStreaks(
      sched4,
      new Set(["2026-09-01", "2026-09-04"]),
      "2026-09-04",
      new Set(["2026-09-02"])
    );
    expect(current).toBe(1);
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

describe("resolveRecordUpdate 跳过语义归一化", () => {
  it("P1 回归：boolean 跳过记录仅改备注不得翻成 is_completed=true", () => {
    const r = resolveRecordUpdate(
      "boolean",
      null,
      { note: "改备注" },
      { is_skipped: true, value_number: null, value_text: null, value_time: null }
    );
    expect(r).toEqual({ is_completed: false, is_skipped: true });
  });

  it("显式 is_skipped:true → 强制跳过不变量", () => {
    const r = resolveRecordUpdate(
      "number",
      30,
      { is_skipped: true, value_number: 100 },
      { is_skipped: false, value_number: 100, value_text: null, value_time: null }
    );
    expect(r).toEqual({ is_completed: false, is_skipped: true });
  });

  it("录入真实数值 → 清除跳过并重算完成（33 ≥ 30）", () => {
    const r = resolveRecordUpdate(
      "number",
      30,
      { value_number: 33 },
      { is_skipped: true, value_number: 33, value_text: null, value_time: null }
    );
    expect(r).toEqual({ is_completed: true, is_skipped: false });
  });

  it("显式 null 值 + 备注（RecordDialog 形态）→ 保持跳过", () => {
    const r = resolveRecordUpdate(
      "duration",
      30,
      { value_number: null, value_text: null, value_time: null, note: "x" },
      { is_skipped: true, value_number: null, value_text: null, value_time: null }
    );
    expect(r).toEqual({ is_completed: false, is_skipped: true });
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
