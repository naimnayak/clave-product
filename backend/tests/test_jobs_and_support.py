"""Application tracking, notifications, contact form and feedback."""

from app.core.utils import utcnow
from app.db import mongo
from tests.helpers import error_code, signed_up


async def _job(job_id: str = "job_1") -> None:
    await mongo.jobs().insert_one({"_id": job_id, "title": "Frontend Intern", "company": "Acme", "active": True, "source": "test", "postedAt": utcnow()})


async def test_application_tracking(client):
    headers = await signed_up(client, "applicant")
    await _job()

    missing = await client.put("/api/applications/nope", json={"status": "applied"}, headers=headers)
    assert missing.status_code == 404

    applied = await client.put("/api/applications/job_1", json={"status": "applied"}, headers=headers)
    assert applied.status_code == 200
    first = applied.json()["data"]
    assert first["title"] == "Frontend Intern" and first["status"] == "applied"

    moved = (await client.put("/api/applications/job_1", json={"status": "interviewing", "notes": "Round 1 on Monday"}, headers=headers)).json()["data"]
    assert moved["status"] == "interviewing" and moved["notes"] == "Round 1 on Monday"
    assert moved["appliedAt"] == first["appliedAt"]  # the original application date is kept

    invalid = await client.put("/api/applications/job_1", json={"status": "hired"}, headers=headers)
    assert invalid.status_code == 422 and error_code(invalid) == "VALIDATION_ERROR"

    assert len((await client.get("/api/applications", headers=headers)).json()["data"]) == 1
    other = await signed_up(client, "other-applicant")
    assert (await client.get("/api/applications", headers=other)).json()["data"] == []

    assert (await client.delete("/api/applications/job_1", headers=headers)).status_code == 204
    assert (await client.get("/api/applications", headers=headers)).json()["data"] == []


async def test_notifications_mark_read(client):
    headers = await signed_up(client, "reader")  # welcome notification
    await _job()
    await client.put("/api/applications/job_1", json={"status": "applied"}, headers=headers)

    listing = (await client.get("/api/notifications", headers=headers)).json()["data"]
    assert listing["unreadCount"] == 2
    newest = listing["items"][0]
    assert newest["title"].endswith("Applied") and newest["link"] == "/jobs?view=applied"

    one = await client.post("/api/notifications/read", json={"ids": [newest["id"]]}, headers=headers)
    assert one.json()["data"]["unreadCount"] == 1
    everything = await client.post("/api/notifications/read", json={"ids": []}, headers=headers)
    assert everything.json()["data"]["unreadCount"] == 0


async def test_contact_form(client):
    message = {"name": "Visitor", "email": "Visitor@Example.com", "topic": "Billing", "message": "How do refunds work for the single plan?"}
    assert (await client.post("/api/contact", json=message)).status_code == 201
    stored = await mongo.contact_messages().find_one({})
    assert stored["email"] == "visitor@example.com" and stored["emailed"] is False  # SMTP is off in tests

    bot = await client.post("/api/contact", json={**message, "website": "http://spam.example"})
    assert bot.status_code == 201
    assert await mongo.contact_messages().count_documents({}) == 1  # honeypot hits are not stored

    short = await client.post("/api/contact", json={**message, "message": "hi"})
    assert short.status_code == 422


async def test_feedback_requires_sign_in(client):
    assert (await client.post("/api/feedback", json={"message": "Nice app"})).status_code == 401
    headers = await signed_up(client, "fan")
    response = await client.post("/api/feedback", json={"message": "Nice app", "page": "/settings", "rating": 5}, headers=headers)
    assert response.status_code == 201
    assert (await mongo.feedback().find_one({"uid": "fan"}))["rating"] == 5
