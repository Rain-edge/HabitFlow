"""Statistics service: computes streaks and completion stats from DB records."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import habit_logic
from app.core.dates import user_today
from app.modules.habits.models import Habit
from app.modules.records.models import HabitRecord
from app.modules.users.models import User


async def completed_dates_for(db: AsyncSession, user_id: int, habit_id: int) -> set[date]:
    rows = await db.scalars(
        select(HabitRecord.record_date).where(
            HabitRecord.user_id == user_id,
            HabitRecord.habit_id == habit_id,
            HabitRecord.deleted_at.is_(None),
            HabitRecord.is_completed.is_(True),
        )
    )
    return set(rows.all())


async def completed_dates_map(db: AsyncSession, user_id: int, habit_ids: list[int]) -> dict[int, set[date]]:
    """Batch variant: one query returns completed dates grouped by habit id (avoids N+1)."""
    if not habit_ids:
        return {}
    rows = await db.execute(
        select(HabitRecord.habit_id, HabitRecord.record_date).where(
            HabitRecord.user_id == user_id,
            HabitRecord.habit_id.in_(habit_ids),
            HabitRecord.deleted_at.is_(None),
            HabitRecord.is_completed.is_(True),
        )
    )
    out: dict[int, set[date]] = {hid: set() for hid in habit_ids}
    for habit_id, d in rows.all():
        out[habit_id].add(d)
    return out


async def record_counts(db: AsyncSession, user_id: int, habit_id: int | None = None):
    """Return (total, normal, backfilled) completed counts."""
    base = [
        HabitRecord.user_id == user_id,
        HabitRecord.deleted_at.is_(None),
        HabitRecord.is_completed.is_(True),
    ]
    if habit_id is not None:
        base.append(HabitRecord.habit_id == habit_id)

    total = len((await db.scalars(select(HabitRecord.id).where(*base))).all())
    normal = len(
        (
            await db.scalars(
                select(HabitRecord.id).where(*base, HabitRecord.is_backfilled.is_(False))
            )
        ).all()
    )
    return total, normal, total - normal


def compute_habit_stats(habit: Habit, completed: set[date], today: date) -> dict:
    """All streak / completion stats for one habit as of today."""
    if habit.schedule_type in ("daily", "weekly_days"):
        scheduled = habit_logic.scheduled_dates(
            habit.start_date,
            today,
            habit.schedule_type,
            weekly_days=habit.weekly_days or [],
            end_date=habit.end_date,
        )
        current, longest = habit_logic.daily_streaks(scheduled, completed, today)
        expected_total = len(scheduled)
        streak_unit = "day"

        last7 = habit_logic.period_stats(scheduled, completed, today - timedelta(days=6), today)
        last30 = habit_logic.period_stats(scheduled, completed, today - timedelta(days=29), today)

        week_start = habit_logic.week_start(today)
        this_week = habit_logic.period_stats(scheduled, completed, week_start, today)
        month_start = today.replace(day=1)
        this_month = habit_logic.period_stats(scheduled, completed, month_start, today)

        weekly = None
    else:  # weekly_count
        target = habit.weekly_target or 1
        current, longest, weeks_total, weeks_met = habit_logic.weekly_goal_streaks(
            habit.start_date, today, target, completed, end_date=habit.end_date
        )
        scheduled = []
        expected_total = weeks_total * target
        streak_unit = "week"

        def _sessions_between(start: date, end: date) -> int:
            return len([d for d in completed if start <= d <= end])

        week_start = habit_logic.week_start(today)
        month_start = today.replace(day=1)
        last7 = {"expected": target, "completed": _sessions_between(today - timedelta(days=6), today)}
        last30 = {"expected": None, "completed": _sessions_between(today - timedelta(days=29), today)}
        this_week = {"expected": target, "completed": _sessions_between(week_start, today)}
        this_month = {"expected": None, "completed": _sessions_between(month_start, today)}
        for p in (last7, last30, this_week, this_month):
            p["rate"] = (
                round(min(100.0, p["completed"] / p["expected"] * 100), 1)
                if p.get("expected")
                else None
            )
        weekly = {
            "target": target,
            "weeks_total": weeks_total,
            "weeks_met": weeks_met,
            "this_week_done": this_week["completed"],
        }

    completion_rate = (
        round(min(100.0, len(completed) / expected_total * 100), 1) if expected_total else 0.0
    )

    return {
        "schedule_type": habit.schedule_type,
        "streak_unit": streak_unit,
        "current_streak": current,
        "longest_streak": longest,
        "expected_total": expected_total,
        "completion_rate": completion_rate,
        "last_7_days": last7,
        "last_30_days": last30,
        "this_week": this_week,
        "this_month": this_month,
        "weekly": weekly,
        "completed_dates": completed,
    }


async def get_habit_stats(db: AsyncSession, user: User, habit: Habit, today: date | None = None) -> dict:
    today = today or user_today(user.timezone)
    completed = await completed_dates_for(db, user.id, habit.id)
    stats = compute_habit_stats(habit, completed, today)
    total, normal, backfilled = await record_counts(db, user.id, habit.id)
    stats["total_completed"] = total
    stats["normal_completed"] = normal
    stats["backfilled_completed"] = backfilled
    return stats
