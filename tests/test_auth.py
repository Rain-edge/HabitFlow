async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_register_and_login(client):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "u1@example.com", "username": "u1", "password": "secret123"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["email"] == "u1@example.com"

    resp = await client.post(
        "/api/auth/login", json={"email": "u1@example.com", "password": "secret123"}
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


async def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "username": "dup1", "password": "secret123"}
    assert (await client.post("/api/auth/register", json=payload)).status_code == 201
    resp = await client.post(
        "/api/auth/register",
        json={"email": "dup@example.com", "username": "dup2", "password": "secret123"},
    )
    assert resp.status_code == 409


async def test_login_wrong_password(client):
    await client.post(
        "/api/auth/register",
        json={"email": "u2@example.com", "username": "u2", "password": "secret123"},
    )
    resp = await client.post(
        "/api/auth/login", json={"email": "u2@example.com", "password": "wrong-pass"}
    )
    assert resp.status_code == 401


async def test_me_requires_auth(client):
    assert (await client.get("/api/users/me")).status_code == 401


async def test_me_returns_profile(user_client):
    resp = await user_client.get("/api/users/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"


async def test_password_not_stored_plain(client):
    data = (
        await client.post(
            "/api/auth/register",
            json={"email": "h@example.com", "username": "hasher", "password": "secret123"},
        )
    ).json()
    assert "secret123" not in str(data)


async def test_change_password(user_client):
    resp = await user_client.post(
        "/api/users/me/password", json={"old_password": "secret123", "new_password": "newpass456"}
    )
    assert resp.status_code == 204
    resp = await user_client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "newpass456"}
    )
    assert resp.status_code == 200


async def test_invalid_token_rejected(client):
    client.headers["Authorization"] = "Bearer not-a-real-token"
    assert (await client.get("/api/users/me")).status_code == 401
