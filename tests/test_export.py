from datetime import date, timedelta


async def test_export_json(user_client):
    today = date.today()
    habit = (await user_client.post("/api/habits", json={"name": "喝水", "record_type": "number", "target_value": 2000, "unit": "ml", "start_date": (today - timedelta(days=7)).isoformat()})).json()
    await user_client.post(
        "/api/records",
        json={"habit_id": habit["id"], "record_date": today.isoformat(), "value_number": 2000},
    )
    await user_client.post(
        "/api/records",
        json={"habit_id": habit["id"], "record_date": (today - timedelta(days=1)).isoformat(), "value_number": 1500},
    )
    await user_client.put(f"/api/journal/{today.isoformat()}", json={"mood": 8, "text": "不错"})

    resp = await user_client.get("/api/export/json")
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    data = resp.json()

    assert data["user"]["username"] == "alice"
    assert len(data["habits"]) == 1
    assert len(data["records"]) == 2
    assert data["journals"][0]["mood"] == 8
    assert str(habit["id"]) in data["statistics"]
    assert data["statistics"][str(habit["id"])]["total_completed"] == 1  # only >= target counts


async def test_export_csv(user_client):
    habit = (await user_client.post("/api/habits", json={"name": "运动"})).json()
    await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()}
    )

    resp = await user_client.get("/api/export/csv")
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    body = resp.text
    assert "== habits ==" in body
    assert "== records ==" in body
    assert "运动" in body
