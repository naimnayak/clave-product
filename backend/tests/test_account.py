"""Sign-in sync, auth errors, sessions, export, deletion and data isolation."""

from app.db import mongo
from tests.helpers import auth, error_code, resume_body, signed_up


async def test_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["database"] == "ok"
    assert data["ai"] in {"configured", "off"}
    # The health check must never reveal which AI model or vendor is used.
    assert set(data) == {"status", "database", "ai"}


async def test_requires_valid_token(client):
    missing = await client.get("/api/me")
    assert missing.status_code == 401 and error_code(missing) == "UNAUTHENTICATED"
    bad = await client.get("/api/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert bad.status_code == 401 and error_code(bad) == "UNAUTHENTICATED"


async def test_sync_creates_user_once_and_welcomes(client):
    first = await client.post("/api/auth/sync", json={"name": "Asha"}, headers=auth("asha"))
    assert first.status_code == 200
    assert first.json()["data"]["isNewUser"] is True
    assert first.json()["data"]["onboardingComplete"] is False

    again = await client.post("/api/auth/sync", json={"name": "Asha"}, headers=auth("asha"))
    assert again.json()["data"]["isNewUser"] is False

    notes = (await client.get("/api/notifications", headers=auth("asha"))).json()["data"]
    assert notes["unreadCount"] == 1
    assert notes["items"][0]["title"] == "Welcome to Clave"


async def test_sessions_list_and_revoke(client):
    phone = await signed_up(client, "ravi", session="phone-session-0001")
    laptop = auth("ravi", session="laptop-session-0002")
    assert (await client.get("/api/me", headers=laptop)).status_code == 200

    security = (await client.get("/api/me/security", headers=laptop)).json()["data"]
    assert len(security["sessions"]) == 2
    assert [s["current"] for s in security["sessions"]].count(True) == 1
    assert security["providers"] == ["password"]

    # The current session can't be revoked individually: that's what Log out is for.
    own = await client.delete("/api/me/sessions/laptop-session-0002", headers=laptop)
    assert own.status_code == 400

    revoked = await client.post("/api/me/sessions/revoke-others", headers=laptop)
    assert revoked.json()["data"]["revoked"] == 1

    blocked = await client.get("/api/me", headers=phone)
    assert blocked.status_code == 401 and error_code(blocked) == "SESSION_REVOKED"
    assert (await client.get("/api/me", headers=laptop)).status_code == 200

    await client.post("/api/auth/logout", headers=laptop)
    after_logout = await client.get("/api/me", headers=laptop)
    assert error_code(after_logout) == "SESSION_REVOKED"


async def test_resumes_are_private(client):
    owner = await signed_up(client, "owner")
    other = await signed_up(client, "other")
    created = await client.post("/api/resumes", json=resume_body(), headers=owner)
    resume_id = created.json()["data"]["id"]

    assert (await client.get(f"/api/resumes/{resume_id}", headers=other)).status_code == 404
    assert (await client.delete(f"/api/resumes/{resume_id}", headers=other)).status_code == 404
    assert (await client.get("/api/resumes", headers=other)).json()["data"] == []
    assert (await client.get(f"/api/resumes/{resume_id}", headers=owner)).status_code == 200


async def test_export_and_delete_account(client):
    headers = await signed_up(client, "leaving")
    await client.post("/api/resumes", json=resume_body("Exported"), headers=headers)

    export = await client.get("/api/me/export", headers=headers)
    assert export.status_code == 200
    assert "attachment" in export.headers["content-disposition"]
    body = export.json()
    assert body["account"]["email"] == "leaving@example.com"
    assert [r["name"] for r in body["resumes"]] == ["Exported"]
    # Internal fields are stripped from the export.
    assert "uid" not in body["resumes"][0]

    assert (await client.delete("/api/me", headers=headers)).status_code == 204
    assert await mongo.users().find_one({"_id": "leaving"}) is None
    assert await mongo.resumes().count_documents({"uid": "leaving"}) == 0
    assert await mongo.notifications().count_documents({"uid": "leaving"}) == 0


async def test_settings_round_trip(client):
    headers = await signed_up(client, "settings-user")
    current = (await client.get("/api/me/settings", headers=headers)).json()["data"]
    current["privacy"]["personalizeAi"] = False
    saved = await client.put("/api/me/settings", json=current, headers=headers)
    assert saved.status_code == 200
    assert (await client.get("/api/me/settings", headers=headers)).json()["data"]["privacy"]["personalizeAi"] is False
