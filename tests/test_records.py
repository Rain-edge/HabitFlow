from datetime import date, timedelta


async def _habit(client, **overrides):
    payload = {"name": "喝水", "record_type": "number", "target_value": 2000, "unit": "ml", **overrides}
    resp = await client.post("/api/habits", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_record(user_client):
    habit = await _habit(user_client)
    resp = await user_client.post(
        "/api/records",
        json={"habit_id": habit["id"], "record_date": date.today().isoformat(), "value_number": 1800},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_completed"] is False  # 1800 < 2000 target
    assert body["is_backfilled"] is False


async def test_record_completion_against_target(user_client):
    habit = await _habit(user_client)
    resp = await user_client.post(
        "/api/records",
        json={"habit_id": habit["id"], "record_date": date.today().isoformat(), "value_number": 2100},
    )
    assert resp.json()["is_completed"] is True


async def test_duplicate_record_same_day_rejected(user_client):
    habit = await _habit(user_client)
    today = date.today().isoformat()
    first = await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": today, "value_number": 1000}
    )
    assert first.status_code == 201
    dup = await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": today, "value_number": 1500}
    )
    assert dup.status_code == 409


async def test_future_date_rejected(user_client):
    habit = await _habit(user_client)
    resp = await user_client.post(
        "/api/records",
        json={"habit_id": habit["id"], "record_date": (date.today() + timedelta(days=1)).isoformat()},
    )
    assert resp.status_code == 400


async def test_backfill_past_date(user_client):
    habit = await _habit(user_client, start_date=(date.today() - timedelta(days=7)).isoformat())
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    resp = await user_client.post(
        "/api/records",
        json={"habit_id": habit["id"], "record_date": yesterday, "value_number": 2000},
    )
    assert resp.status_code == 201
    assert resp.json()["is_backfilled"] is True


async def test_backfill_disabled(user_client):
    habit = await _habit(
        user_client, allow_backfill=False, start_date=(date.today() - timedelta(days=7)).isoformat()
    )
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    resp = await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": yesterday, "value_number": 2000}
    )
    assert resp.status_code == 403


async def test_record_before_start_date_rejected(user_client):
    habit = await _habit(user_client, start_date=date.today().isoformat())
    resp = await user_client.post(
        "/api/records",
        json={"habit_id": habit["id"], "record_date": (date.today() - timedelta(days=1)).isoformat()},
    )
    assert resp.status_code == 400


async def test_update_historical_record(user_client):
    habit = await _habit(user_client, start_date=(date.today() - timedelta(days=7)).isoformat())
    yesterday = date.today() - timedelta(days=1)
    rec = (
        await user_client.post(
            "/api/records",
            json={"habit_id": habit["id"], "record_date": yesterday.isoformat(), "value_number": 500},
        )
    ).json()
    assert rec["is_completed"] is False

    resp = await user_client.put(f"/api/records/{rec['id']}", json={"value_number": 2500})
    assert resp.status_code == 200
    assert resp.json()["is_completed"] is True
    assert resp.json()["is_backfilled"] is True


async def test_delete_record_allows_recheck(user_client):
    habit = await _habit(user_client)
    today = date.today().isoformat()
    rec = (
        await user_client.post(
            "/api/records", json={"habit_id": habit["id"], "record_date": today, "value_number": 100}
        )
    ).json()

    assert (await user_client.delete(f"/api/records/{rec['id']}")).status_code == 204

    # the date is free again, and the unique constraint survives soft delete
    again = await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": today, "value_number": 3000}
    )
    assert again.status_code == 201
    assert again.json()["is_completed"] is True


async def test_boolean_record(user_client):
    habit = await _habit(user_client, name="认真吃饭", record_type="boolean", target_value=None, unit=None)
    resp = await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()}
    )
    assert resp.status_code == 201
    assert resp.json()["is_completed"] is True


async def test_select_text_time_types(user_client):
    today = date.today().isoformat()

    sel = await _habit(user_client, name="状态", record_type="select", target_value=None,
                       unit=None, select_options=["很好", "不错", "一般"])
    r = await user_client.post(
        "/api/records", json={"habit_id": sel["id"], "record_date": today, "value_text": "不错"}
    )
    assert r.status_code == 201 and r.json()["is_completed"] is True

    time_habit = await _habit(user_client, name="睡觉时间", record_type="time", target_value=None, unit=None)
    r = await user_client.post(
        "/api/records", json={"habit_id": time_habit["id"], "record_date": today, "value_time": "22:40"}
    )
    assert r.status_code == 201 and r.json()["is_completed"] is True

    text_habit = await _habit(user_client, name="日记", record_type="text", target_value=None, unit=None)
    r = await user_client.post(
        "/api/records", json={"habit_id": text_habit["id"], "record_date": today, "value_text": "今天不错"}
    )
    assert r.status_code == 201 and r.json()["is_completed"] is True


async def test_list_records_filters(user_client):
    today = date.today()
    habit = await _habit(user_client, start_date=(today - timedelta(days=7)).isoformat())
    for i in range(3):
        await user_client.post(
            "/api/records",
            json={
                "habit_id": habit["id"],
                "record_date": (today - timedelta(days=i)).isoformat(),
                "value_number": 2000,
            },
        )
    all_recs = (await user_client.get(f"/api/records?habit_id={habit['id']}")).json()
    assert len(all_recs) == 3

    one = (await user_client.get(f"/api/records?on_date={today.isoformat()}")).json()
    assert len(one) == 1
