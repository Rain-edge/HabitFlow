from datetime import date, timedelta


async def _habit(client, **overrides):
    payload = {"name": "喝水", "record_type": "boolean", **overrides}
    resp = await client.post("/api/habits", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _check(client, habit_id, day: date):
    resp = await client.post("/api/records", json={"habit_id": habit_id, "record_date": day.isoformat()})
    assert resp.status_code == 201, resp.text


async def test_achievements_catalog_listed(user_client):
    resp = await user_client.get("/api/achievements")
    assert resp.status_code == 200
    codes = {a["code"] for a in resp.json()}
    assert {"streak_3", "streak_7", "streak_30", "streak_100", "total_10", "full_month"} <= codes
    assert all(a["unlocked"] is False for a in resp.json())


async def test_streak_achievement_unlocks(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=6)).isoformat())
    for i in range(7):
        await _check(user_client, habit["id"], today - timedelta(days=i))

    resp = await user_client.get("/api/achievements")
    by_code = {a["code"]: a for a in resp.json()}
    assert by_code["streak_3"]["unlocked"] is True
    assert by_code["streak_7"]["unlocked"] is True
    assert by_code["streak_14"]["unlocked"] is False
    details = by_code["streak_7"]["unlocked_details"][0]
    assert details["habit_name"] == "喝水"


async def test_total_achievement_unlocks(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=10)).isoformat())
    for i in range(10):
        await _check(user_client, habit["id"], today - timedelta(days=i))

    by_code = {a["code"]: a for a in (await user_client.get("/api/achievements")).json()}
    assert by_code["total_10"]["unlocked"] is True
    assert by_code["total_50"]["unlocked"] is False


async def test_achievement_not_duplicated(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=3)).isoformat())
    for i in range(4):
        await _check(user_client, habit["id"], today - timedelta(days=i))

    first = {a["code"]: a for a in (await user_client.get("/api/achievements")).json()}
    count1 = first["streak_3"]["unlocked_count"]

    # another check-in must not duplicate the unlock
    await user_client.post("/api/achievements/evaluate")
    second = {a["code"]: a for a in (await user_client.get("/api/achievements")).json()}
    assert second["streak_3"]["unlocked_count"] == count1 == 1
