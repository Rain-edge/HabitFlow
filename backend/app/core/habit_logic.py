"""Pure habit logic: completion rules, scheduling, streaks.

No database access here — everything is computed from plain values so the
algorithms can be unit tested exhaustively.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Literal

RecordType = Literal["boolean", "number", "duration", "rating", "select", "text", "time"]
ScheduleType = Literal["daily", "weekly_count", "weekly_days"]

RECORD_TYPES = ("boolean", "number", "duration", "rating", "select", "text", "time")
SCHEDULE_TYPES = ("daily", "weekly_count", "weekly_days")


def is_record_completed(
    record_type: str,
    *,
    target_value: float | None = None,
    value_number: float | None = None,
    value_text: str | None = None,
    value_time: str | None = None,
    is_completed: bool | None = None,
) -> bool:
    """Decide whether a single record counts as completed for its habit type."""
    if record_type == "boolean":
        return bool(is_completed) if is_completed is not None else True
    if record_type in ("number", "duration"):
        if value_number is None:
            return False
        if target_value is not None:
            return value_number >= target_value
        return value_number > 0
    if record_type == "rating":
        if value_number is None:
            return False
        if target_value is not None:
            return value_number >= target_value
        return True
    if record_type == "select":
        return bool(value_text)
    if record_type == "text":
        return bool(value_text and value_text.strip())
    if record_type == "time":
        return bool(value_time)
    return False


def week_start(d: date) -> date:
    """Monday-based start of the ISO week containing d."""
    return d - timedelta(days=d.weekday())


def scheduled_dates(
    start_date: date,
    today: date,
    schedule_type: str,
    weekly_days: Iterable[int] = (),
    end_date: date | None = None,
) -> list[date]:
    """All dates on which a daily / weekly-days habit is expected, up to today."""
    if schedule_type == "weekly_count":
        return []
    cap = today
    if end_date is not None:
        cap = min(cap, end_date)
    if start_date > cap:
        return []
    allowed = set(weekly_days)
    out: list[date] = []
    d = start_date
    while d <= cap:
        if schedule_type == "daily" or d.weekday() in allowed:
            out.append(d)
        d += timedelta(days=1)
    return out


def daily_streaks(
    scheduled: list[date], completed: set[date], today: date
) -> tuple[int, int]:
    """Current + longest streak over an ordered list of scheduled dates.

    Grace rule: if today is scheduled but not yet completed, it does not break
    the current streak — evaluation stops at yesterday.
    """
    if not scheduled:
        return 0, 0
    status = [d in completed for d in scheduled]

    longest = run = 0
    for ok in status:
        run = run + 1 if ok else 0
        longest = max(longest, run)

    idx = len(scheduled) - 1
    if scheduled[-1] == today and not status[-1]:
        idx -= 1
    current = 0
    while idx >= 0 and status[idx]:
        current += 1
        idx -= 1
    return current, longest


def weekly_goal_streaks(
    start_date: date,
    today: date,
    weekly_target: int,
    completed_dates: set[date],
    end_date: date | None = None,
) -> tuple[int, int, int, int]:
    """Streaks measured in weeks for 'N times per week' habits.

    Returns (current_weeks, longest_weeks, weeks_total, weeks_met).
    """
    if weekly_target <= 0:
        return 0, 0, 0, 0
    cap = today
    if end_date is not None:
        cap = min(cap, end_date)
    if start_date > cap:
        return 0, 0, 0, 0

    first, last = week_start(start_date), week_start(cap)
    weeks: list[date] = []
    w = first
    while w <= last:
        weeks.append(w)
        w += timedelta(days=7)

    per_week: dict[date, int] = {}
    for d in completed_dates:
        if d < start_date or d > cap:
            continue
        key = week_start(d)
        per_week[key] = per_week.get(key, 0) + 1

    met = [per_week.get(w, 0) >= weekly_target for w in weeks]

    longest = run = 0
    for ok in met:
        run = run + 1 if ok else 0
        longest = max(longest, run)

    idx = len(weeks) - 1
    current_week = week_start(today)
    if weeks[-1] == current_week and not met[-1]:
        idx -= 1  # the in-progress week does not break the streak
    current = 0
    while idx >= 0 and met[idx]:
        current += 1
        idx -= 1

    return current, longest, len(weeks), sum(met)


def period_stats(
    scheduled: list[date], completed: set[date], start: date, end: date
) -> dict:
    """Completion counts for a date range (inclusive)."""
    sched_in = [d for d in scheduled if start <= d <= end]
    done_in = [d for d in sched_in if d in completed]
    return {
        "expected": len(sched_in),
        "completed": len(done_in),
        "rate": round(len(done_in) / len(sched_in) * 100, 1) if sched_in else 0.0,
    }
