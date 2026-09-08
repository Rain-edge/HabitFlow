async def _create(client, **overrides):
    payload = {"name": "喝水", "record_type": "boolean", **overrides}
    resp = await client.post("/api/habits", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_habit(user_client):
    habit = await _create(user_client, record_type="number", target_value=2000, unit="ml")
    assert habit["name"] == "喝水"
    assert habit["record_type"] == "number"
    assert habit["target_value"] == 2000
    assert habit["schedule_type"] == "daily"


async def test_list_habits(user_client):
    await _create(user_client, name="A")
    await _create(user_client, name="B")
    resp = await user_client.get("/api/habits")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_update_habit(user_client):
    habit = await _create(user_client)
    resp = await user_client.put(f"/api/habits/{habit['id']}", json={"name": "认真喝水", "target_value": 2500})
    assert resp.status_code == 200
    assert resp.json()["name"] == "认真喝水"


async def test_invalid_record_type_rejected(user_client):
    resp = await user_client.post("/api/habits", json={"name": "X", "record_type": "whatever"})
    assert resp.status_code == 422


async def test_weekly_count_requires_target(user_client):
    resp = await user_client.post(
        "/api/habits", json={"name": "运动", "record_type": "boolean", "schedule_type": "weekly_count"}
    )
    assert resp.status_code == 422


async def test_weekly_days_requires_days(user_client):
    resp = await user_client.post(
        "/api/habits", json={"name": "运动", "record_type": "boolean", "schedule_type": "weekly_days"}
    )
    assert resp.status_code == 422


async def test_weekly_days_habit_created(user_client):
    habit = await _create(user_client, schedule_type="weekly_days", weekly_days=[0, 2, 4])
    assert habit["weekly_days"] == [0, 2, 4]


async def test_select_requires_options(user_client):
    resp = await user_client.post("/api/habits", json={"name": "状态", "record_type": "select"})
    assert resp.status_code == 422
    habit = await _create(
        user_client, name="状态", record_type="select", select_options=["很好", "不错", "一般", "不太好", "很差"]
    )
    assert len(habit["select_options"]) == 5


async def test_soft_delete_keeps_records(user_client):
    from datetime import date

    habit = await _create(user_client)
    resp = await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()}
    )
    assert resp.status_code == 201

    resp = await user_client.delete(f"/api/habits/{habit['id']}")
    assert resp.status_code == 204

    # habit disappears from the active list
    habits = (await user_client.get("/api/habits")).json()
    assert all(h["id"] != habit["id"] for h in habits)

    # ...but shows up with include_deleted and records remain
    habits = (await user_client.get("/api/habits?include_deleted=true")).json()
    assert any(h["id"] == habit["id"] for h in habits)
    records = (await user_client.get(f"/api/records?habit_id={habit['id']}")).json()
    assert len(records) == 1

    # history still contributes to stats
    stats = (await user_client.get(f"/api/statistics/habit/{habit['id']}")).json()
    assert stats["total_completed"] == 1


async def test_restore_habit(user_client):
    habit = await _create(user_client)
    await user_client.delete(f"/api/habits/{habit['id']}")
    resp = await user_client.post(f"/api/habits/{habit['id']}/restore")
    assert resp.status_code == 200
    assert resp.json()["deleted_at"] is None
