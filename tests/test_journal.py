from datetime import date, timedelta


async def test_journal_upsert_and_read(user_client):
    today = date.today().isoformat()

    empty = (await user_client.get(f"/api/journal/{today}")).json()
    assert empty["has_entry"] is False

    resp = await user_client.put(
        f"/api/journal/{today}",
        json={"mood": 8, "energy": 7, "overall": 8, "text": "今天整体状态不错"},
    )
    assert resp.status_code == 200
    assert resp.json()["mood"] == 8

    again = (await user_client.get(f"/api/journal/{today}")).json()
    assert again["has_entry"] is True
    assert again["text"] == "今天整体状态不错"

    # upsert again must not duplicate
    await user_client.put(f"/api/journal/{today}", json={"mood": 9})
    again = (await user_client.get(f"/api/journal/{today}")).json()
    assert again["mood"] == 9
    assert again["energy"] == 7  # other fields preserved


async def test_journal_rating_bounds(user_client):
    today = date.today().isoformat()
    resp = await user_client.put(f"/api/journal/{today}", json={"mood": 11})
    assert resp.status_code == 422


async def test_journal_future_date_rejected(user_client):
    future = (date.today() + timedelta(days=2)).isoformat()
    resp = await user_client.put(f"/api/journal/{future}", json={"mood": 5})
    assert resp.status_code == 400


async def test_journal_delete(user_client):
    today = date.today().isoformat()
    await user_client.put(f"/api/journal/{today}", json={"text": "hi"})
    assert (await user_client.delete(f"/api/journal/{today}")).status_code == 204
    again = (await user_client.get(f"/api/journal/{today}")).json()
    assert again["has_entry"] is False
    # can recreate after delete
    resp = await user_client.put(f"/api/journal/{today}", json={"text": "again"})
    assert resp.status_code == 200
