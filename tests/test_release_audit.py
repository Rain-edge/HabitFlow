"""Release-readiness audit tests: date system, streaks, weekly goals,
consistency, pause/resume. All exercised through the real API."""

from datetime import date, timedelta

from app.core import habit_logic as L


async def _habit(client, **over):
    payload = {"name": "审计", "record_type": "boolean", **over}
    r = await client.post("/api/habits", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


async def _check(client, hid, day, **val):
    r = await client.post("/api/records", json={"habit_id": hid, "record_date": day.isoformat(), **val})
    assert r.status_code == 201, r.text
    return r.json()


async def _stats(client, hid):
    r = await client.get(f"/api/statistics/habit/{hid}")
    assert r.status_code == 200
    return r.json()


# ---------- date boundaries (pure) ----------
def test_month_and_year_boundaries():
    # cross-month
    s = L.scheduled_dates(date(2026, 8, 30), date(2026, 9, 1), "daily")
    assert s == [date(2026, 8, 30), date(2026, 8, 31), date(2026, 9, 1)]
    # cross-year
    s = L.scheduled_dates(date(2026, 12, 31), date(2027, 1, 1), "daily")
    assert s == [date(2026, 12, 31), date(2027, 1, 1)]
    # month start
    s = L.scheduled_dates(date(2026, 9, 1), date(2026, 9, 1), "daily")
    assert s == [date(2026, 9, 1)]


def test_leap_and_non_leap():
    assert date(2028, 2, 29) in L.scheduled_dates(date(2028, 2, 1), date(2028, 2, 29), "daily")
    assert len(L.scheduled_dates(date(2027, 2, 1), date(2027, 2, 28), "daily")) == 28


# ---------- streak lengths 1/3/7/30 + break ----------
async def _streak_for(client, n_days, miss_offsets=()):
    today = date.today()
    h = await _habit(client, start_date=(today - timedelta(days=40)).isoformat())
    for i in range(n_days):
        if i in miss_offsets:
            continue
        await _check(client, h["id"], today - timedelta(days=i))
    return h, await _stats(client, h["id"])


async def test_streak_1_3_7_30(user_client):
    for n in (1, 3, 7, 30):
        h, s = await _streak_for(user_client, n)
        assert s["current_streak"] == n, f"expected {n}, got {s['current_streak']}"
        assert s["longest_streak"] == n
        assert s["total_completed"] == n


async def test_break_one_day(user_client):
    today = date.today()
    h = await _habit(user_client, start_date=(today - timedelta(days=6)).isoformat())
    for i in (6, 5, 4, 3, 0):  # gap at 2,1 -> current from today only
        await _check(user_client, h["id"], today - timedelta(days=i))
    s = await _stats(user_client, h["id"])
    assert s["current_streak"] == 1
    assert s["longest_streak"] == 4


# ---------- backfill / modify / delete history ----------
async def test_backfill_modify_delete_history(user_client):
    today = date.today()
    h = await _habit(user_client, record_type="number", target_value=100,
                     start_date=(today - timedelta(days=5)).isoformat())
    # backfill
    b = await _check(user_client, h["id"], today - timedelta(days=2), value_number=150)
    assert b["is_backfilled"] is True
    # modify -> recompute completion
    await user_client.put(f"/api/records/{b['id']}", json={"value_number": 50})
    s = await _stats(user_client, h["id"])
    assert s["total_completed"] == 0  # 50 < 100 no longer completed
    # delete history record -> date freed, stats drop
    await user_client.delete(f"/api/records/{b['id']}")
    recs = (await user_client.get(f"/api/records?habit_id={h['id']}")).json()
    assert recs == []


# ---------- pause / resume ----------
async def test_pause_and_resume(user_client):
    today = date.today()
    h = await _habit(user_client, start_date=(today - timedelta(days=3)).isoformat())
    for i in range(3):
        await _check(user_client, h["id"], today - timedelta(days=i))

    # pause
    await user_client.put(f"/api/habits/{h['id']}", json={"is_active": False})
    dash = (await user_client.get("/api/statistics/today")).json()
    assert all(i["habit_id"] != h["id"] for i in dash["items"])  # hidden from today
    # history still intact
    s = await _stats(user_client, h["id"])
    assert s["total_completed"] == 3
    # resume
    await user_client.put(f"/api/habits/{h['id']}", json={"is_active": True})
    dash = (await user_client.get("/api/statistics/today")).json()
    assert any(i["habit_id"] == h["id"] for i in dash["items"])


# ---------- weekly goal ----------
def _week_monday(offset_weeks):
    today = date.today()
    return today - timedelta(days=today.weekday()) - timedelta(weeks=offset_weeks)


async def test_weekly_goal_met_and_streak(user_client):
    last_sunday = _week_monday(1) + timedelta(days=6)
    h = await _habit(user_client, schedule_type="weekly_count", weekly_target=3,
                     start_date=_week_monday(3).isoformat(), end_date=last_sunday.isoformat())
    # three fully-met past weeks
    for w in (3, 2, 1):
        base = _week_monday(w)
        for off in (0, 1, 2):
            await _check(user_client, h["id"], base + timedelta(days=off))
    s = await _stats(user_client, h["id"])
    assert s["weekly"]["target"] == 3
    assert s["weekly"]["weeks_met"] == 3
    assert s["weekly"]["weeks_total"] == 3
    assert s["current_streak"] == 3  # weekly goal streak in weeks
    assert s["longest_streak"] == 3


async def test_weekly_goal_not_met_week(user_client):
    last_sunday = _week_monday(1) + timedelta(days=6)
    h = await _habit(user_client, schedule_type="weekly_count", weekly_target=3,
                     start_date=_week_monday(3).isoformat(), end_date=last_sunday.isoformat())
    for off in (0, 1, 2):  # week3 met
        await _check(user_client, h["id"], _week_monday(3) + timedelta(days=off))
    for off in (0, 1):  # week2 only 2 -> not met
        await _check(user_client, h["id"], _week_monday(2) + timedelta(days=off))
    for off in (0, 1, 2):  # week1 met
        await _check(user_client, h["id"], _week_monday(1) + timedelta(days=off))
    s = await _stats(user_client, h["id"])
    assert s["weekly"]["weeks_met"] == 2
    assert s["longest_streak"] == 1  # broken by the unmet middle week
    assert s["current_streak"] == 1


# ---------- consistency: duplicate submit ----------
async def test_duplicate_submit_rejected(user_client):
    today = date.today()
    h = await _habit(user_client)
    first = await user_client.post("/api/records", json={"habit_id": h["id"], "record_date": today.isoformat()})
    assert first.status_code == 201
    # rapid duplicate (simulates double click / retry after timeout)
    dup = await user_client.post("/api/records", json={"habit_id": h["id"], "record_date": today.isoformat()})
    assert dup.status_code == 409
    recs = (await user_client.get(f"/api/records?habit_id={h['id']}")).json()
    assert len(recs) == 1


# ---------- soft-deleted habit history still queryable ----------
async def test_deleted_habit_history_queryable(user_client):
    today = date.today()
    h = await _habit(user_client)
    await _check(user_client, h["id"], today)
    await user_client.delete(f"/api/habits/{h['id']}")
    # records still listable
    recs = (await user_client.get(f"/api/records?habit_id={h['id']}")).json()
    assert len(recs) == 1
    # stats still computable
    s = await _stats(user_client, h["id"])
    assert s["total_completed"] == 1
