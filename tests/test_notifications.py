from datetime import date, datetime


async def test_notification_settings_defaults_and_update(user_client):
    resp = await user_client.get("/api/notifications/settings")
    assert resp.status_code == 200
    assert resp.json()["daily_summary_time"] == "22:00"

    resp = await user_client.put(
        "/api/notifications/settings",
        json={"daily_summary_time": "22:30", "habit_reminders_enabled": False},
    )
    assert resp.json()["daily_summary_time"] == "22:30"
    assert resp.json()["habit_reminders_enabled"] is False

    resp = await user_client.put("/api/notifications/settings", json={"daily_summary_time": "25:99"})
    assert resp.status_code == 422


async def test_pending_reminders(user_client):
    habit = (
        await user_client.post(
            "/api/habits", json={"name": "运动", "reminder_enabled": True, "reminder_time": "20:00"}
        )
    ).json()

    resp = await user_client.get("/api/notifications/pending")
    assert resp.status_code == 200
    pendings = resp.json()["pending"]
    assert len(pendings) == 1
    assert pendings[0]["habit_id"] == habit["id"]
    assert "运动" in pendings[0]["message"]

    await user_client.post(
        "/api/records", json={"habit_id": habit["id"], "record_date": date.today().isoformat()}
    )
    pendings = (await user_client.get("/api/notifications/pending")).json()["pending"]
    assert pendings == []


async def test_inbox_read_flow(db, user_client):
    from app.modules.notifications.models import NotificationEvent

    me = (await user_client.get("/api/users/me")).json()
    async with db() as session:
        session.add(NotificationEvent(user_id=me["id"], title="测试通知", body="内容", kind="test"))
        await session.commit()

    inbox = (await user_client.get("/api/notifications/inbox")).json()
    assert len(inbox) == 1
    assert inbox[0]["is_read"] is False

    assert (await user_client.post(f"/api/notifications/inbox/{inbox[0]['id']}/read")).status_code == 204
    inbox = (await user_client.get("/api/notifications/inbox")).json()
    assert inbox[0]["is_read"] is True

    async with db() as session:
        session.add(NotificationEvent(user_id=me["id"], title="另一条", kind="test2"))
        await session.commit()
    assert (await user_client.post("/api/notifications/inbox/read-all")).status_code == 204
    unread = (await user_client.get("/api/notifications/inbox?unread_only=true")).json()
    assert unread == []


async def test_scheduler_creates_events(db, user_client):
    """scan_once produces habit reminder + daily summary events when due."""
    from sqlalchemy import select

    from app.modules.notifications.models import NotificationSettings
    from app.modules.notifications.scheduler import scan_once

    await user_client.post(
        "/api/habits", json={"name": "早睡", "reminder_enabled": True, "reminder_time": "00:00"}
    )

    now_hhmm = datetime.now().strftime("%H:%M")
    habits = (await user_client.get("/api/habits")).json()
    await user_client.put(f"/api/habits/{habits[0]['id']}", json={"reminder_time": now_hhmm})

    me = (await user_client.get("/api/users/me")).json()
    async with db() as session:
        s = await session.scalar(
            select(NotificationSettings).where(NotificationSettings.user_id == me["id"])
        )
        if s is None:
            s = NotificationSettings(user_id=me["id"])
            session.add(s)
        s.daily_summary_time = now_hhmm
        s.daily_summary_enabled = True
        s.habit_reminders_enabled = True
        await session.commit()

    created = await scan_once(session_factory=db)
    assert created >= 2

    inbox = (await user_client.get("/api/notifications/inbox")).json()
    kinds = {e["kind"] for e in inbox}
    assert any(k.startswith("habit:") for k in kinds)
    assert any(k.startswith("summary:") for k in kinds)

    # running again must not duplicate (dedup by kind)
    created_again = await scan_once(session_factory=db)
    assert created_again == 0
