"""Cross-user permission isolation tests."""

from datetime import date


async def _register(client, email, username):
    resp = await client.post(
        "/api/auth/register", json={"email": email, "username": username, "password": "secret123"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


async def test_user_cannot_see_others_habits(client):
    token_a = await _register(client, "a@ex.com", "usera")
    token_b = await _register(client, "b@ex.com", "userb")

    client.headers["Authorization"] = f"Bearer {token_a}"
    habit = (await client.post("/api/habits", json={"name": "A的私密习惯"})).json()

    client.headers["Authorization"] = f"Bearer {token_b}"
    habits = (await client.get("/api/habits")).json()
    assert habits == []

    for path in (
        f"/api/habits/{habit['id']}",
        f"/api/statistics/habit/{habit['id']}",
    ):
        assert (await client.get(path)).status_code == 404
    assert (await client.put(f"/api/habits/{habit['id']}", json={"name": "hack"})).status_code == 404
    assert (await client.delete(f"/api/habits/{habit['id']}")).status_code == 404


async def test_user_cannot_touch_others_records(client):
    token_a = await _register(client, "a2@ex.com", "usera2")
    token_b = await _register(client, "b2@ex.com", "userb2")

    client.headers["Authorization"] = f"Bearer {token_a}"
    habit = (await client.post("/api/habits", json={"name": "喝水"})).json()
    record = (
        await client.post(
            "/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()}
        )
    ).json()

    client.headers["Authorization"] = f"Bearer {token_b}"
    assert (await client.get("/api/records")).json() == []
    assert (await client.put(f"/api/records/{record['id']}", json={"note": "hack"})).status_code == 404
    assert (await client.delete(f"/api/records/{record['id']}")).status_code == 404

    # cannot create a record against someone else's habit
    resp = await client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()}
    )
    assert resp.status_code == 404


async def test_user_cannot_read_others_journal(client):
    token_a = await _register(client, "a3@ex.com", "usera3")
    token_b = await _register(client, "b3@ex.com", "userb3")
    today = date.today().isoformat()

    client.headers["Authorization"] = f"Bearer {token_a}"
    await client.put(f"/api/journal/{today}", json={"text": "秘密日记"})

    client.headers["Authorization"] = f"Bearer {token_b}"
    resp = (await client.get(f"/api/journal/{today}")).json()
    assert resp["has_entry"] is False
    assert resp["text"] is None


async def test_export_only_own_data(client):
    token_a = await _register(client, "a4@ex.com", "usera4")
    token_b = await _register(client, "b4@ex.com", "userb4")

    client.headers["Authorization"] = f"Bearer {token_a}"
    habit = (await client.post("/api/habits", json={"name": "运动"})).json()
    await client.post("/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()})

    client.headers["Authorization"] = f"Bearer {token_b}"
    data = (await client.get("/api/export/json")).json()
    assert data["habits"] == []
    assert data["records"] == []


async def test_stats_isolated(client):
    token_a = await _register(client, "a5@ex.com", "usera5")
    token_b = await _register(client, "b5@ex.com", "userb5")

    client.headers["Authorization"] = f"Bearer {token_a}"
    habit = (await client.post("/api/habits", json={"name": "阅读"})).json()
    await client.post("/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()})

    client.headers["Authorization"] = f"Bearer {token_b}"
    dash = (await client.get("/api/statistics/today")).json()
    assert dash["scheduled_count"] == 0
    assert dash["items"] == []
