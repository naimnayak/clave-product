"""Admin panel: access control, user management, plans, payments, support and the audit log."""

from datetime import timedelta

from app.api import admin as admin_api
from app.core.utils import utcnow
from app.db import mongo
from tests.helpers import auth, error_code, resume_body, signed_up

# ADMIN_EMAILS=owner@example.com in conftest; test tokens use <uid>@example.com and are verified.


async def _actions(target: str) -> list[str]:
    return [a["action"] async for a in mongo.admin_audit().find({"target": target}).sort("at", 1)]


async def test_only_staff_can_open_the_panel(client):
    user = await signed_up(client, "regular")
    assert (await client.get("/api/admin/me", headers=user)).status_code == 403
    assert (await client.get("/api/admin/overview", headers=user)).status_code == 403
    assert (await client.get("/api/admin/me")).status_code == 401

    owner = await signed_up(client, "owner")
    me = (await client.get("/api/admin/me", headers=owner)).json()["data"]
    assert me["role"] == "admin" and me["owner"] is True and "plans" in me["permissions"]
    assert (await client.get("/api/me", headers=owner)).json()["data"]["role"] == "admin"

    # A stored role can't be self-assigned through any user endpoint; only the panel sets it.
    await client.put("/api/me", json={"name": "Sneaky", "role": "admin"}, headers=user)
    assert (await client.get("/api/admin/me", headers=user)).status_code == 403


async def test_overview_and_user_search(client):
    owner = await signed_up(client, "owner")
    await signed_up(client, "alice")
    await signed_up(client, "bob")
    await mongo.users().update_one({"_id": "bob"}, {"$set": {"subscription.plan": "monthly", "subscription.currentPeriodEnd": utcnow() + timedelta(days=3)}})
    await mongo.payments().insert_one({"_id": "order_1", "uid": "bob", "plan": "monthly", "amount": 19900, "status": "paid", "createdAt": utcnow(), "paidAt": utcnow()})

    data = (await client.get("/api/admin/overview", headers=owner)).json()["data"]
    assert data["users"]["total"] == 3 and data["subscriptions"]["pro"] == 1 and data["subscriptions"]["proExpiring7d"] == 1
    assert data["revenue"]["thisMonth"] == 199 and len(data["series"]["signups"]) == 30

    found = (await client.get("/api/admin/users", params={"q": "ALI"}, headers=owner)).json()["data"]
    assert [u["id"] for u in found["items"]] == ["alice"] and found["total"] == 1
    pro = (await client.get("/api/admin/users", params={"plan": "pro"}, headers=owner)).json()["data"]
    assert [u["id"] for u in pro["items"]] == ["bob"]
    free = (await client.get("/api/admin/users", params={"plan": "free"}, headers=owner)).json()["data"]
    assert {u["id"] for u in free["items"]} == {"owner", "alice"}

    detail = (await client.get("/api/admin/users/bob", headers=owner)).json()["data"]
    assert detail["isPro"] and detail["payments"][0]["amount"] == 199 and detail["counts"]["resumes"] == 0

    csv_export = await client.get("/api/admin/users/export.csv", headers=owner)
    assert csv_export.status_code == 200 and "bob@example.com" in csv_export.text
    assert "users.export" in [a["action"] async for a in mongo.admin_audit().find({})]


async def test_subscription_credits_and_usage_changes_are_audited(client):
    owner = await signed_up(client, "owner")
    user = await signed_up(client, "customer")

    granted = (await client.post("/api/admin/users/customer/subscription", json={"action": "grant", "days": 30, "reason": "Beta tester"}, headers=owner)).json()["data"]
    assert granted["isPro"] and granted["compedByAdmin"]
    assert (await client.get("/api/subscriptions/current", headers=user)).json()["data"]["isPro"] is True

    extended = (await client.post("/api/admin/users/customer/subscription", json={"action": "extend", "days": 10}, headers=owner)).json()["data"]
    doc = await mongo.users().find_one({"_id": "customer"})
    assert timedelta(days=39) < doc["subscription"]["currentPeriodEnd"] - utcnow() <= timedelta(days=40) and extended["isPro"]

    revoked = (await client.post("/api/admin/users/customer/subscription", json={"action": "revoke"}, headers=owner)).json()["data"]
    assert revoked["isPro"] is False

    credits = (await client.post("/api/admin/users/customer/credits", json={"delta": -5}, headers=owner)).json()["data"]
    assert credits["singleResumesBalance"] == 0  # never negative
    assert (await client.post("/api/admin/users/customer/credits", json={"delta": 2}, headers=owner)).json()["data"]["singleResumesBalance"] == 2

    await client.post("/api/resumes", json=resume_body(), headers=user)
    reset = (await client.post("/api/admin/users/customer/reset", json={"what": "resumes"}, headers=owner)).json()["data"]
    assert reset["resumesCreated"] == 0

    assert await _actions("customer") == [
        "subscription.grant", "subscription.extend", "subscription.revoke", "credits.change", "credits.change", "usage.reset.resumes",
    ]
    history = (await client.get("/api/admin/users/customer", headers=owner)).json()["data"]["history"]
    assert history[0]["action"] == "usage.reset.resumes" and history[0]["actorEmail"] == "owner@example.com"


async def test_suspension_signs_the_user_out(client):
    owner = await signed_up(client, "owner")
    user = await signed_up(client, "troll")

    suspended = await client.post("/api/admin/users/troll/status", json={"status": "suspended", "reason": "Spam"}, headers=owner)
    assert suspended.json()["data"]["status"] == "suspended"
    blocked = await client.get("/api/me", headers=user)
    assert blocked.status_code == 401 and error_code(blocked) == "ACCOUNT_SUSPENDED"
    assert (await client.get("/api/admin/users", params={"status": "suspended"}, headers=owner)).json()["data"]["total"] == 1

    await client.post("/api/admin/users/troll/status", json={"status": "active"}, headers=owner)
    assert (await client.get("/api/me", headers=user)).status_code == 200

    # Owners and your own account are protected.
    other_admin = await signed_up(client, "second-admin")
    await client.post("/api/admin/users/second-admin/role", json={"role": "admin"}, headers=owner)
    for target in ("owner", "second-admin"):
        response = await client.post(f"/api/admin/users/{target}/status", json={"status": "suspended"}, headers=other_admin)
        assert response.status_code == 409, target


async def test_support_role_is_read_only(client):
    owner = await signed_up(client, "owner")
    support = await signed_up(client, "helper")
    await signed_up(client, "member")
    assert (await client.post("/api/admin/users/helper/role", json={"role": "support"}, headers=owner)).status_code == 200

    assert (await client.get("/api/admin/users", headers=support)).status_code == 200
    assert (await client.get("/api/admin/overview", headers=support)).status_code == 200
    note = await client.post("/api/admin/users/member/notes", json={"text": "Asked about refunds"}, headers=support)
    assert note.status_code == 201

    for method, path, body in [
        ("post", "/api/admin/users/member/subscription", {"action": "grant"}),
        ("put", "/api/admin/plans/monthly", {"price": 1}),
        ("post", "/api/admin/users/member/role", {"role": "admin"}),
        ("post", "/api/admin/users/member/status", {"status": "suspended"}),
        ("post", "/api/admin/broadcast", {"title": "Hi"}),
        ("get", "/api/admin/users/export.csv", None),
    ]:
        response = await getattr(client, method)(path, **({"json": body} if body is not None else {}), headers=support)
        assert response.status_code == 403, path

    # Demoting takes access away immediately.
    await client.post("/api/admin/users/helper/role", json={"role": "user"}, headers=owner)
    assert (await client.get("/api/admin/me", headers=support)).status_code == 403


async def test_plan_editing_changes_prices_and_limits(client):
    owner = await signed_up(client, "owner")
    user = await signed_up(client, "shopper")

    updated = await client.put("/api/admin/plans/monthly", json={"price": 249, "name": "Clave Pro Plus", "periodDays": 31}, headers=owner)
    assert updated.status_code == 200 and updated.json()["data"]["price"] == 249
    public = (await client.get("/api/subscriptions/plans")).json()["data"]
    assert public["monthly"]["price"] == 249 and public["monthly"]["name"] == "Clave Pro Plus"

    assert (await client.put("/api/admin/plans/free", json={"price": 10}, headers=owner)).status_code == 422
    assert (await client.put("/api/admin/plans/free", json={"active": False}, headers=owner)).status_code == 422
    assert (await client.put("/api/admin/plans/single", json={"price": 0}, headers=owner)).status_code == 422

    limits = {"resumes": 2, "aiDaily": 3, "chatDaily": 4, "mockInterviews": 0}
    await client.put("/api/admin/plans/free", json={"limits": limits, "features": {"jobs": False, "jobPreview": True, "chatMemory": True}}, headers=owner)
    assert (await client.get("/api/subscriptions/current", headers=user)).json()["data"]["resumesAllowance"] == 2

    audit = await mongo.admin_audit().find_one({"action": "plan.update", "target": "monthly"})
    assert audit["details"]["before"]["price"] == 199 and audit["details"]["after"]["price"] == 249


async def test_refund_takes_back_the_plan(client, monkeypatch):
    owner = await signed_up(client, "owner")
    await signed_up(client, "refundee")
    end = utcnow() + timedelta(days=30)
    await mongo.users().update_one({"_id": "refundee"}, {"$set": {"subscription.plan": "monthly", "subscription.currentPeriodEnd": end}})
    await mongo.payments().insert_one({"_id": "order_r", "uid": "refundee", "plan": "monthly", "amount": 19900, "status": "paid", "paymentId": "pay_r", "createdAt": utcnow(), "paidAt": utcnow()})
    calls = []
    monkeypatch.setattr(admin_api, "_razorpay_refund", lambda payment_id, amount: calls.append((payment_id, amount)) or {"id": "rfnd_1"})

    refunded = await client.post("/api/admin/payments/order_r/refund", json={"reason": "Asked within 7 days"}, headers=owner)
    assert refunded.status_code == 200 and refunded.json()["data"]["status"] == "refunded"
    assert calls == [("pay_r", 19900)]
    assert (await client.get("/api/admin/users/refundee", headers=owner)).json()["data"]["isPro"] is False

    again = await client.post("/api/admin/payments/order_r/refund", json={}, headers=owner)
    assert again.status_code == 409 and len(calls) == 1
    listed = (await client.get("/api/admin/payments", params={"status": "refunded"}, headers=owner)).json()["data"]
    assert listed["items"][0]["userEmail"] == "refundee@example.com"


async def test_delete_needs_the_email_typed_back(client):
    owner = await signed_up(client, "owner")
    await signed_up(client, "leaver")
    wrong = await client.post("/api/admin/users/leaver/delete", json={"confirmEmail": "someone@example.com"}, headers=owner)
    assert wrong.status_code == 422
    assert (await client.post("/api/admin/users/leaver/delete", json={"confirmEmail": "Leaver@example.com"}, headers=owner)).status_code == 200
    assert await mongo.users().find_one({"_id": "leaver"}) is None
    assert "user.delete" in await _actions("leaver")


async def test_support_inbox_broadcast_and_jobs(client):
    owner = await signed_up(client, "owner")
    member = await signed_up(client, "listener")
    await client.post("/api/contact", json={"name": "Visitor", "email": "v@example.com", "message": "How do refunds work here?"})
    inbox = (await client.get("/api/admin/support/messages", headers=owner)).json()["data"]
    assert inbox["total"] == 1
    message_id = inbox["items"][0]["id"]
    await client.post(f"/api/admin/support/messages/{message_id}/status", json={"status": "resolved"}, headers=owner)
    assert (await client.get("/api/admin/support/messages", headers=owner)).json()["data"]["total"] == 0

    sent = (await client.post("/api/admin/broadcast", json={"title": "New feature", "body": "Try the job feed", "link": "/jobs", "audience": "all"}, headers=owner)).json()["data"]
    assert sent["sent"] == 2
    titles = [n["title"] for n in (await client.get("/api/notifications", headers=member)).json()["data"]["items"]]
    assert "New feature" in titles
    bad_link = await client.post("/api/admin/broadcast", json={"title": "x", "link": "https://evil.example"}, headers=owner)
    assert bad_link.status_code == 422

    await mongo.jobs().insert_one({"_id": "job_spam", "title": "Spam", "company": "X", "active": True, "source": "apify:indeed", "postedAt": utcnow()})
    assert (await client.post("/api/admin/jobs/job_spam/active", json={"active": False}, headers=owner)).status_code == 200
    stats = (await client.get("/api/admin/jobs/stats", headers=owner)).json()["data"]
    assert stats["active"] == 0 and stats["latestJobs"][0]["active"] is False

    log = (await client.get("/api/admin/audit", params={"action": "broadcast"}, headers=owner)).json()["data"]
    assert log["total"] == 1 and log["items"][0]["details"]["sent"] == 2


async def test_unverified_emails_are_never_owners(client, monkeypatch):
    from tests import conftest

    original = conftest._fake_verify

    def unverified(token, **kwargs):
        return {**original(token, **kwargs), "email_verified": False}

    monkeypatch.setattr("app.core.security.firebase_auth.verify_id_token", unverified)
    headers = auth("owner")
    await client.post("/api/auth/sync", json={"name": "owner"}, headers=headers)
    assert (await client.get("/api/admin/me", headers=headers)).status_code == 403
