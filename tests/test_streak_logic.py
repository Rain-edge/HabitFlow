"""Exhaustive tests for the streak / scheduling algorithms (pure functions)."""

from datetime import date, timedelta

from app.core import habit_logic as L


def _dates(*iso: str) -> set[date]:
    return {date.fromisoformat(d) for d in iso}


def test_spec_example_broken_streak():
    """8/25-8/27 done, 8/28 missed, 8/29 done -> current=1, longest=3."""
    scheduled = [date(2026, 8, d) for d in range(25, 30)]
    completed = _dates("2026-08-25", "2026-08-26", "2026-08-27", "2026-08-29")
    current, longest = L.daily_streaks(scheduled, completed, date(2026, 8, 29))
    assert current == 1
    assert longest == 3


def test_today_grace_does_not_break_streak():
    """Done yesterday and before, today not yet recorded -> streak keeps counting."""
    scheduled = [date(2026, 8, d) for d in range(25, 30)]
    completed = _dates("2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28")
    current, longest = L.daily_streaks(scheduled, completed, date(2026, 8, 29))
    assert current == 4
    assert longest == 4


def test_every_day_done():
    scheduled = [date(2026, 1, 1) + timedelta(days=i) for i in range(10)]
    current, longest = L.daily_streaks(scheduled, set(scheduled), date(2026, 1, 10))
    assert current == 10 and longest == 10


def test_gap_breaks_streak_but_longest_kept():
    scheduled = [date(2026, 3, 1) + timedelta(days=i) for i in range(8)]
    completed = set(scheduled[:5]) | {scheduled[6], scheduled[7]}  # miss day 6
    current, longest = L.daily_streaks(scheduled, completed, scheduled[-1])
    assert current == 2
    assert longest == 5


def test_leap_year_boundary():
    """Streak crossing Feb 28 -> Feb 29 in a leap year must stay connected."""
    scheduled = L.scheduled_dates(date(2028, 2, 27), date(2028, 3, 1), "daily")
    assert date(2028, 2, 29) in scheduled
    current, longest = L.daily_streaks(scheduled, set(scheduled), date(2028, 3, 1))
    assert current == 4 and longest == 4


def test_non_leap_year():
    scheduled = L.scheduled_dates(date(2027, 2, 27), date(2027, 3, 1), "daily")
    assert date(2027, 2, 28) in scheduled
    assert len(scheduled) == 3  # Feb 27, 28, Mar 1 — no Feb 29 in 2027


def test_year_boundary():
    scheduled = L.scheduled_dates(date(2026, 12, 30), date(2027, 1, 2), "daily")
    assert scheduled == [date(2026, 12, 30), date(2026, 12, 31), date(2027, 1, 1), date(2027, 1, 2)]
    current, longest = L.daily_streaks(scheduled, set(scheduled), date(2027, 1, 2))
    assert current == 4


def test_weekly_days_schedule():
    # 2026-08-24 is Monday
    scheduled = L.scheduled_dates(date(2026, 8, 24), date(2026, 9, 6), "weekly_days", weekly_days=[0, 2, 4])
    assert all(d.weekday() in (0, 2, 4) for d in scheduled)
    assert len(scheduled) == 6


def test_weekly_days_streak_ignores_off_days():
    """Mon/Wed/Fri habit: missing Tuesday must not break the streak."""
    scheduled = L.scheduled_dates(date(2026, 8, 24), date(2026, 8, 28), "weekly_days", weekly_days=[0, 2, 4])
    completed = set(scheduled)  # Mon, Wed, Fri done
    current, longest = L.daily_streaks(scheduled, completed, date(2026, 8, 28))
    assert current == 3 and longest == 3


def test_weekly_days_miss_breaks():
    scheduled = L.scheduled_dates(date(2026, 8, 24), date(2026, 8, 28), "weekly_days", weekly_days=[0, 2, 4])
    completed = set(scheduled) - {date(2026, 8, 26)}  # missed Wednesday
    current, longest = L.daily_streaks(scheduled, completed, date(2026, 8, 28))
    assert current == 1
    assert longest == 1


def test_end_date_caps_schedule():
    scheduled = L.scheduled_dates(date(2026, 8, 1), date(2026, 8, 29), "daily", end_date=date(2026, 8, 10))
    assert scheduled[-1] == date(2026, 8, 10)


def test_weekly_goal_spec_example():
    """Mon/Wed/Fri done with target 3 -> week is met."""
    # week of 2026-08-24
    done = _dates("2026-08-24", "2026-08-26", "2026-08-28")
    current, longest, weeks_total, weeks_met = L.weekly_goal_streaks(
        date(2026, 8, 24), date(2026, 8, 30), 3, done
    )
    assert weeks_total == 1
    assert weeks_met == 1
    assert current == 1 and longest == 1


def test_weekly_goal_multi_week_streak():
    """Three consecutive weeks meeting target -> current 3 weeks."""
    done = set()
    for week_start_day in (24, 31):  # Aug 24 week, Aug 31 week
        for offset in (0, 2, 4):
            done.add(date(2026, 8, week_start_day) + timedelta(days=offset))
    for offset in (0, 2, 4):
        done.add(date(2026, 9, 7) + timedelta(days=offset))

    current, longest, weeks_total, weeks_met = L.weekly_goal_streaks(
        date(2026, 8, 24), date(2026, 9, 13), 3, done
    )
    assert weeks_total == 3
    assert weeks_met == 3
    assert current == 3 and longest == 3


def test_weekly_goal_broken_week():
    done = set()
    for offset in (0, 2, 4):
        done.add(date(2026, 8, 24) + timedelta(days=offset))  # week 1 met
    done.add(date(2026, 9, 1))  # week 2: only once -> not met
    for offset in (0, 2, 4):
        done.add(date(2026, 9, 7) + timedelta(days=offset))  # week 3 met

    current, longest, weeks_total, weeks_met = L.weekly_goal_streaks(
        date(2026, 8, 24), date(2026, 9, 13), 3, done
    )
    assert weeks_met == 2
    assert current == 1
    assert longest == 1


def test_weekly_goal_in_progress_week_grace():
    """Current week not yet met does not break the streak."""
    done = set()
    for offset in (0, 2, 4):
        done.add(date(2026, 8, 24) + timedelta(days=offset))  # week 1 met
    done.add(date(2026, 9, 1))  # week 2 in progress: only 1 so far

    current, longest, _, _ = L.weekly_goal_streaks(date(2026, 8, 24), date(2026, 9, 2), 3, done)
    assert current == 1
    assert longest == 1


def test_period_stats():
    scheduled = [date(2026, 8, d) for d in range(23, 30)]
    completed = _dates("2026-08-23", "2026-08-24", "2026-08-29")
    p = L.period_stats(scheduled, completed, date(2026, 8, 23), date(2026, 8, 29))
    assert p["expected"] == 7
    assert p["completed"] == 3
    assert p["rate"] == 42.9


def test_completion_rules():
    assert L.is_record_completed("boolean") is True
    assert L.is_record_completed("boolean", is_completed=False) is False
    assert L.is_record_completed("number", target_value=2000, value_number=1999) is False
    assert L.is_record_completed("number", target_value=2000, value_number=2000) is True
    assert L.is_record_completed("duration", target_value=30, value_number=45) is True
    assert L.is_record_completed("duration", value_number=None) is False
    assert L.is_record_completed("rating", value_number=5) is True
    assert L.is_record_completed("select", value_text="很好") is True
    assert L.is_record_completed("select", value_text=None) is False
    assert L.is_record_completed("text", value_text="  ") is False
    assert L.is_record_completed("time", value_time="22:30") is True
