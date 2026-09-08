"""Achievement definitions and evaluation."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import habit_logic
from app.core.dates import user_today
from app.core.timeutils import utcnow
from app.modules.achievements.models import Achievement, UserAchievement
from app.modules.habits.models import Habit
from app.modules.statistics.service import completed_dates_for, compute_habit_stats, record_counts
from app.modules.users.models import User

CATALOG: list[dict] = [
    # streaks (per habit, based on longest streak)
    {"code": "streak_3", "name": "初次坚持", "description": "连续坚持 3 天", "icon": "🌱", "category": "streak", "threshold": 3},
    {"code": "streak_7", "name": "一周达人", "description": "连续坚持 7 天", "icon": "🔥", "category": "streak", "threshold": 7},
    {"code": "streak_14", "name": "两周不断", "description": "连续坚持 14 天", "icon": "⚡", "category": "streak", "threshold": 14},
    {"code": "streak_30", "name": "月度坚持", "description": "连续坚持 30 天", "icon": "🏅", "category": "streak", "threshold": 30},
    {"code": "streak_50", "name": "五十日之约", "description": "连续坚持 50 天", "icon": "🎖️", "category": "streak", "threshold": 50},
    {"code": "streak_100", "name": "百日坚持", "description": "连续坚持 100 天", "icon": "🏆", "category": "streak", "threshold": 100},
    # totals (per habit cumulative completions)
    {"code": "total_10", "name": "小有所成", "description": "单个习惯累计完成 10 次", "icon": "✨", "category": "total", "threshold": 10},
    {"code": "total_50", "name": "积少成多", "description": "单个习惯累计完成 50 次", "icon": "💪", "category": "total", "threshold": 50},
    {"code": "total_100", "name": "百次里程碑", "description": "单个习惯累计完成 100 次", "icon": "🌟", "category": "total", "threshold": 100},
    {"code": "total_365", "name": "一年之约", "description": "单个习惯累计完成 365 次", "icon": "👑", "category": "total", "threshold": 365},
    # calendar (per habit)
    {"code": "full_month", "name": "圆满一月", "description": "一个自然月内全部应完成日都完成", "icon": "🗓️", "category": "calendar", "threshold": 1},
    {"code": "full_quarter", "name": "圆满一季", "description": "连续三个自然月全部应完成日都完成", "icon": "🎯", "category": "calendar", "threshold": 3},
]


async def ensure_catalog(db: AsyncSession) -> None:
    count = await db.scalar(select(Achievement.id).limit(1))
    if count is not None:
        return
    for item in CATALOG:
        db.add(Achievement(**item))
    await db.commit()


def _months_between(start: date, end: date) -> list[tuple[date, date]]:
    """All (month_start, month_end) pairs overlapping [start, end]."""
    out = []
    y, m = start.year, start.month
    while date(y, m, 1) <= end:
        first = date(y, m, 1)
        if m == 12:
            nxt = date(y + 1, 1, 1)
        else:
            nxt = date(y, m + 1, 1)
        out.append((first, nxt - timedelta(days=1)))
        y, m = nxt.year, nxt.month
    return out


def _full_months(scheduled: list[date], completed: set[date], today: date) -> int:
    """Max consecutive fully-completed calendar months (only finished months)."""
    if not scheduled:
        return 0
    months = _months_between(scheduled[0], min(scheduled[-1], today))
    sched_set = set(scheduled)
    best = run = 0
    for first, last in months:
        if last > today:
            break  # month still in progress
        in_month = [d for d in sched_set if first <= d <= last]
        if not in_month:
            continue
        if all(d in completed for d in in_month):
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


async def evaluate_user(db: AsyncSession, user: User) -> list[str]:
    """Re-evaluate all achievements for a user. Returns newly unlocked codes."""
    await ensure_catalog(db)
    today = user_today(user.timezone)
    habits = list(
        (await db.scalars(select(Habit).where(Habit.user_id == user.id))).all()
    )

    achievements = list((await db.scalars(select(Achievement))).all())
    by_code = {a.code: a for a in achievements}

    rows = (
        await db.execute(
            select(UserAchievement.achievement_id, UserAchievement.habit_id).where(
                UserAchievement.user_id == user.id
            )
        )
    ).all()
    existing = set(rows)

    new_unlocks: list[str] = []

    for habit in habits:
        completed = await completed_dates_for(db, user.id, habit.id)
        stats = compute_habit_stats(habit, completed, today)
        total, _, _ = await record_counts(db, user.id, habit.id)

        candidates: list[tuple[str, int]] = []
        for a in achievements:
            if a.category == "streak" and stats["streak_unit"] == "day":
                if stats["longest_streak"] >= a.threshold:
                    candidates.append((a.code, habit.id))
            elif a.category == "total":
                if total >= a.threshold:
                    candidates.append((a.code, habit.id))

        if habit.schedule_type != "weekly_count":
            scheduled = habit_logic.scheduled_dates(
                habit.start_date, today, habit.schedule_type, habit.weekly_days or [], habit.end_date
            )
            consecutive_full = _full_months(scheduled, completed, today)
            if consecutive_full >= 1:
                candidates.append(("full_month", habit.id))
            if consecutive_full >= 3:
                candidates.append(("full_quarter", habit.id))

        for code, habit_id in candidates:
            a = by_code[code]
            if (a.id, habit_id) in existing:
                continue
            db.add(
                UserAchievement(
                    user_id=user.id, achievement_id=a.id, habit_id=habit_id, unlocked_at=utcnow()
                )
            )
            existing.add((a.id, habit_id))
            new_unlocks.append(f"{code}:{habit.name}")

    if new_unlocks:
        await db.commit()
    return new_unlocks
