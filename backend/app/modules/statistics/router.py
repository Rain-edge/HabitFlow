from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import habit_logic
from app.core.database import get_db
from app.core.dates import user_today
from app.core.deps import get_current_user
from app.modules.daily_journal.models import DailyJournal
from app.modules.habits.models import Habit
from app.modules.records.models import HabitRecord
from app.modules.statistics.service import completed_dates_map, compute_habit_stats, get_habit_stats, record_counts
from app.modules.users.models import User

router = APIRouter(prefix="/api/statistics", tags=["statistics"])

RANGES = {
    "today": 1,
    "week": 7,
    "month": 30,
    "30d": 30,
    "90d": 90,
}


async def _active_habits(db: AsyncSession, user_id: int, include_deleted=False) -> list[Habit]:
    stmt = select(Habit).where(Habit.user_id == user_id)
    if not include_deleted:
        stmt = stmt.where(Habit.deleted_at.is_(None))
    result = await db.scalars(stmt.order_by(Habit.created_at.asc()))
    return list(result.all())


def _is_scheduled_on(habit: Habit, d: date) -> bool:
    if d < habit.start_date or (habit.end_date and d > habit.end_date):
        return False
    if habit.schedule_type == "daily":
        return True
    if habit.schedule_type == "weekly_days":
        return d.weekday() in (habit.weekly_days or [])
    return False


async def _completed_map(db: AsyncSession, user_id: int, habits: list[Habit]) -> dict[int, set[date]]:
    return await completed_dates_map(db, user_id, [h.id for h in habits])


@router.get("/today")
async def stats_today(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    today = user_today(user.timezone)
    habits = [h for h in await _active_habits(db, user.id) if h.is_active]
    completed_map = await _completed_map(db, user.id, habits)

    items = []
    scheduled_count = 0
    done_count = 0
    for habit in habits:
        completed = completed_map[habit.id]
        today_done = today in completed
        if habit.schedule_type == "weekly_count":
            stats = compute_habit_stats(habit, completed, today)
            items.append(
                {
                    "habit_id": habit.id,
                    "name": habit.name,
                    "icon": habit.icon,
                    "color": habit.color,
                    "record_type": habit.record_type,
                    "target_value": habit.target_value,
                    "unit": habit.unit,
                    "schedule_type": habit.schedule_type,
                    "scheduled_today": False,
                    "done_today": today_done,
                    "current_streak": stats["weekly"]["this_week_done"],
                    "streak_unit": "week",
                    "weekly": stats["weekly"],
                }
            )
            continue

        scheduled = _is_scheduled_on(habit, today)
        if scheduled and habit.counts_for_daily:
            scheduled_count += 1
            if today_done:
                done_count += 1

        current, longest = habit_logic.daily_streaks(
            habit_logic.scheduled_dates(
                habit.start_date, today, habit.schedule_type, habit.weekly_days or [], habit.end_date
            ),
            completed,
            today,
        )
        items.append(
            {
                "habit_id": habit.id,
                "name": habit.name,
                "icon": habit.icon,
                "color": habit.color,
                "record_type": habit.record_type,
                "target_value": habit.target_value,
                "unit": habit.unit,
                "schedule_type": habit.schedule_type,
                "scheduled_today": scheduled,
                "done_today": today_done,
                "current_streak": current,
                "streak_unit": "day",
                "weekly": None,
            }
        )

    items = [i for i in items]  # homepage filtering done client-side via show_on_homepage
    show_ids = {h.id: h.show_on_homepage for h in habits}
    for item in items:
        item["show_on_homepage"] = show_ids[item["habit_id"]]

    records_today = (
        (
            await db.scalars(
                select(HabitRecord).where(
                    HabitRecord.user_id == user.id,
                    HabitRecord.record_date == today,
                    HabitRecord.deleted_at.is_(None),
                )
            )
        )
        .all()
    )
    record_map = {r.habit_id: r for r in records_today}
    for item in items:
        rec = record_map.get(item["habit_id"])
        item["record"] = None
        if rec is not None:
            item["record"] = {
                "id": rec.id,
                "value_number": rec.value_number,
                "value_text": rec.value_text,
                "value_time": rec.value_time,
                "is_backfilled": rec.is_backfilled,
            }

    journal = await db.scalar(
        select(DailyJournal).where(
            DailyJournal.user_id == user.id,
            DailyJournal.journal_date == today,
            DailyJournal.deleted_at.is_(None),
        )
    )

    return {
        "date": today.isoformat(),
        "weekday": today.weekday(),
        "completion_rate": round(done_count / scheduled_count * 100, 1) if scheduled_count else 100.0,
        "scheduled_count": scheduled_count,
        "done_count": done_count,
        "items": items,
        "journal": {
            "mood": journal.mood,
            "energy": journal.energy,
            "overall": journal.overall,
            "text": journal.text,
            "has_entry": journal is not None,
        }
        if journal
        else {"mood": None, "energy": None, "overall": None, "text": None, "has_entry": False},
    }


@router.get("/overview")
async def stats_overview(
    range: str = Query(default="30d"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if range not in RANGES and range != "all":
        raise HTTPException(status_code=400, detail="Invalid range")
    today = user_today(user.timezone)
    habits = await _active_habits(db, user.id)

    if range == "all":
        starts = [h.start_date for h in habits] or [today]
        start = min(starts)
    else:
        start = today - timedelta(days=RANGES[range] - 1)

    total_expected = 0
    total_completed = 0
    weekly_met = 0
    weekly_total = 0
    per_habit = []
    completed_map = await _completed_map(db, user.id, habits)

    for habit in habits:
        completed = completed_map[habit.id]
        stats = compute_habit_stats(habit, completed, today)
        if habit.schedule_type == "weekly_count":
            weekly = stats["weekly"]
            if weekly:
                weekly_total += weekly["weeks_total"]
                weekly_met += weekly["weeks_met"]
        else:
            p = habit_logic.period_stats(
                habit_logic.scheduled_dates(
                    habit.start_date, today, habit.schedule_type, habit.weekly_days or [], habit.end_date
                ),
                completed,
                start,
                today,
            )
            total_expected += p["expected"]
            total_completed += p["completed"]
        per_habit.append(
            {
                "habit_id": habit.id,
                "name": habit.name,
                "icon": habit.icon,
                "schedule_type": habit.schedule_type,
                "current_streak": stats["current_streak"],
                "longest_streak": stats["longest_streak"],
                "streak_unit": stats["streak_unit"],
                "completion_rate": stats["completion_rate"],
                "total_completed": stats.get("expected_total"),
                "deleted": habit.deleted_at is not None,
            }
        )

    active_habits = [h for h in habits if h.deleted_at is None]
    best = worst = None
    candidates = [
        (h, p)
        for h, p in zip(habits, per_habit)
        if h.deleted_at is None and h.schedule_type != "weekly_count" and p["completion_rate"] is not None
    ]
    if candidates:
        best_h, best_p = max(candidates, key=lambda x: x[1]["completion_rate"])
        worst_h, worst_p = min(candidates, key=lambda x: x[1]["completion_rate"])
        best = {"habit_id": best_h.id, "name": best_h.name, "icon": best_h.icon, "rate": best_p["completion_rate"]}
        worst = {"habit_id": worst_h.id, "name": worst_h.name, "icon": worst_h.icon, "rate": worst_p["completion_rate"]}

    total_records, normal_records, backfilled_records = await record_counts(db, user.id)
    distinct_days = len(
        (
            await db.scalars(
                select(HabitRecord.record_date)
                .where(
                    HabitRecord.user_id == user.id,
                    HabitRecord.deleted_at.is_(None),
                    HabitRecord.is_completed.is_(True),
                )
                .distinct()
            )
        ).all()
    )

    return {
        "range": range,
        "start": start.isoformat(),
        "end": today.isoformat(),
        "completion_rate": round(total_completed / total_expected * 100, 1) if total_expected else None,
        "expected": total_expected,
        "completed": total_completed,
        "weekly_goal": {"met": weekly_met, "total": weekly_total} if weekly_total else None,
        "total_records": total_records,
        "normal_records": normal_records,
        "backfilled_records": backfilled_records,
        "record_days": distinct_days,
        "most_stable": best,
        "most_fragile": worst,
        "habits": per_habit,
        "active_habit_count": len(active_habits),
    }


@router.get("/trend")
async def stats_trend(
    days: int = Query(default=30, ge=7, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = user_today(user.timezone)
    start = today - timedelta(days=days - 1)
    habits = [h for h in await _active_habits(db, user.id) if h.schedule_type != "weekly_count"]
    completed_map = await _completed_map(db, user.id, habits)

    series = []
    d = start
    while d <= today:
        expected = 0
        done = 0
        for habit in habits:
            if habit.counts_for_daily and _is_scheduled_on(habit, d):
                expected += 1
                if d in completed_map[habit.id]:
                    done += 1
        series.append(
            {
                "date": d.isoformat(),
                "expected": expected,
                "completed": done,
                "rate": round(done / expected * 100, 1) if expected else None,
            }
        )
        d += timedelta(days=1)
    return {"days": days, "series": series}


@router.get("/calendar")
async def stats_calendar(
    year: int = Query(ge=2000, le=2100),
    month: int = Query(ge=1, le=12),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = user_today(user.timezone)
    habits = [h for h in await _active_habits(db, user.id) if h.schedule_type != "weekly_count"]
    completed_map = await _completed_map(db, user.id, habits)

    first = date(year, month, 1)
    if month == 12:
        nxt = date(year + 1, 1, 1)
    else:
        nxt = date(year, month + 1, 1)
    last = nxt - timedelta(days=1)

    days = []
    d = first
    while d <= last:
        expected = 0
        done = 0
        for habit in habits:
            if habit.counts_for_daily and _is_scheduled_on(habit, d):
                expected += 1
                if d in completed_map[habit.id]:
                    done += 1
        if d > today:
            status = "future"
        elif expected == 0:
            status = "empty"
        elif done == expected:
            status = "full"
        elif done == 0:
            status = "none"
        else:
            status = "partial"
        days.append({"date": d.isoformat(), "status": status, "done": done, "expected": expected})
        d += timedelta(days=1)
    return {"year": year, "month": month, "days": days}


@router.get("/habit/{habit_id}")
async def stats_habit(
    habit_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    habit = await db.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id:
        raise HTTPException(status_code=404, detail="Habit not found")
    today = user_today(user.timezone)
    stats = await get_habit_stats(db, user, habit, today)
    stats["completed_dates"] = sorted(d.isoformat() for d in stats["completed_dates"])

    records = (
        (
            await db.scalars(
                select(HabitRecord).where(
                    HabitRecord.user_id == user.id,
                    HabitRecord.habit_id == habit.id,
                    HabitRecord.deleted_at.is_(None),
                ).order_by(HabitRecord.record_date.asc())
            )
        )
        .all()
    )
    stats["values"] = [
        {
            "id": r.id,
            "date": r.record_date.isoformat(),
            "value_number": r.value_number,
            "value_text": r.value_text,
            "value_time": r.value_time,
            "is_completed": r.is_completed,
            "is_backfilled": r.is_backfilled,
        }
        for r in records
    ]
    return stats
