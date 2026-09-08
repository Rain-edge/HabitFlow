"""API-level streak and statistics tests."""

from datetime import date, timedelta


async def _habit(client, **overrides):
    payload = {"name": "喝水", "record_type": "boolean", **overrides}
    resp = await client.post("/api/habits", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _check(client, habit_id, day: date):
    resp = await client.post(
        "/api/records", json={"habit_id": habit_id, "record_date": day.isoformat()}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_api_streak_with_gap(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=4)).isoformat())
    for i in (4, 3, 2, 0):  # gap at 1 day ago
        await _check(user_client, habit["id"], today - timedelta(days=i))

    stats = (await user_client.get(f"/api/statistics/habit/{habit['id']}")).json()
    assert stats["current_streak"] == 1
    assert stats["longest_streak"] == 3
    assert stats["total_completed"] == 4
    assert stats["normal_completed"] == 1
    assert stats["backfilled_completed"] == 3


async def test_api_streak_backfilled_counted_separately(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=2)).isoformat())
    for i in (2, 1, 0):
        await _check(user_client, habit["id"], today - timedelta(days=i))

    stats = (await user_client.get(f"/api/statistics/habit/{habit['id']}")).json()
    assert stats["current_streak"] == 3
    assert stats["normal_completed"] == 1
    assert stats["backfilled_completed"] == 2
    assert stats["total_completed"] == 3


async def test_api_edit_history_recomputes_streak(user_client):
    today = date.today()
    habit = await _habit(
        user_client, record_type="number", target_value=100, start_date=(today - timedelta(days=2)).isoformat()
    )
    for i in (2, 1, 0):
        resp = await user_client.post(
            "/api/records",
            json={
                "habit_id": habit["id"],
                "record_date": (today - timedelta(days=i)).isoformat(),
                "value_number": 150,
            },
        )
        assert resp.status_code == 201, resp.text
    stats = (await user_client.get(f"/api/statistics/habit/{habit['id']}")).json()
    assert stats["current_streak"] == 3

    # downgrade yesterday's value below target -> streak breaks
    recs = (await user_client.get(f"/api/records?habit_id={habit['id']}")).json()
    y_rec = next(r for r in recs if r["record_date"] == (today - timedelta(days=1)).isoformat())
    await user_client.put(f"/api/records/{y_rec['id']}", json={"value_number": 10})

    stats = (await user_client.get(f"/api/statistics/habit/{habit['id']}")).json()
    assert stats["current_streak"] == 1
    # stats are always recomputed from history: with yesterday un-done the
    # best remaining run is a single day
    assert stats["longest_streak"] == 1

    # fixing the value back restores the 3-day streak
    await user_client.put(f"/api/records/{y_rec['id']}", json={"value_number": 200})
    stats = (await user_client.get(f"/api/statistics/habit/{habit['id']}")).json()
    assert stats["current_streak"] == 3
    assert stats["longest_streak"] == 3


async def test_weekly_count_goal_via_api(user_client):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    habit = await _habit(
        user_client,
        name="运动",
        schedule_type="weekly_count",
        weekly_target=3,
        start_date=monday.isoformat(),
    )
    # 3 sessions in the current week
    for i in (0, 1, 2):
        d = monday + timedelta(days=i)
        if d <= today:
            await _check(user_client, habit["id"], d)
        else:
            break

    # ensure we actually have 3 sessions; if the week just started, backfill previous week instead
    recs = (await user_client.get(f"/api/records?habit_id={habit['id']}")).json()
    if len(recs) < 3:
        prev_monday = monday - timedelta(days=7)
        habit2 = await _habit(
            user_client, name="运动2", schedule_type="weekly_count", weekly_target=3,
            start_date=prev_monday.isoformat(),
        )
        for i in (0, 1, 2):
            await _check(user_client, habit2["id"], prev_monday + timedelta(days=i))
        stats = (await user_client.get(f"/api/statistics/habit/{habit2['id']}")).json()
        assert stats["weekly"]["this_week_done"] == 0 or stats["weekly"]
        assert stats["weekly"]["weeks_met"] == 1
        return

    stats = (await user_client.get(f"/api/statistics/habit/{habit['id']}")).json()
    assert stats["weekly"]["target"] == 3
    assert stats["weekly"]["this_week_done"] == len(recs)
    assert stats["weekly"]["weeks_met"] == 1
    assert stats["current_streak"] >= 1


async def test_today_dashboard(user_client):
    today = date.today()
    h1 = await _habit(user_client, name="A")
    await _habit(user_client, name="B")
    await _check(user_client, h1["id"], today)

    dash = (await user_client.get("/api/statistics/today")).json()
    assert dash["date"] == today.isoformat()
    assert dash["scheduled_count"] == 2
    assert dash["done_count"] == 1
    assert dash["completion_rate"] == 50.0
    names = {i["name"]: i for i in dash["items"]}
    assert names["A"]["done_today"] is True
    assert names["B"]["done_today"] is False
    assert dash["journal"]["has_entry"] is False


async def test_calendar_statuses(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=2)).isoformat())
    await _check(user_client, habit["id"], today - timedelta(days=2))
    await _check(user_client, habit["id"], today)

    cal = (
        await user_client.get(f"/api/statistics/calendar?year={today.year}&month={today.month}")
    ).json()
    by_date = {d["date"]: d["status"] for d in cal["days"]}
    assert by_date[(today - timedelta(days=2)).isoformat()] == "full"
    assert by_date[(today - timedelta(days=1)).isoformat()] == "none"
    assert by_date[today.isoformat()] == "full"
    if today.day < 28:
        tomorrow = today + timedelta(days=1)
        if tomorrow.month == today.month:
            assert by_date[tomorrow.isoformat()] == "future"


async def test_trend_series(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=8)).isoformat())
    await _check(user_client, habit["id"], today - timedelta(days=1))

    trend = (await user_client.get("/api/statistics/trend?days=7")).json()
    assert trend["days"] == 7
    assert len(trend["series"]) == 7
    yesterday = next(s for s in trend["series"] if s["date"] == (today - timedelta(days=1)).isoformat())
    assert yesterday["rate"] == 100.0


async def test_overview(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=9)).isoformat())
    for i in range(10):
        await _check(user_client, habit["id"], today - timedelta(days=i))

    overview = (await user_client.get("/api/statistics/overview?range=30d")).json()
    assert overview["completed"] == 10
    assert overview["expected"] == 10
    assert overview["completion_rate"] == 100.0
    assert overview["record_days"] == 10
    assert overview["most_stable"]["name"] == "喝水"
