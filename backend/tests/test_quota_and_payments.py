"""Resume allowance (Free / Single credit / Monthly), upload exemption and Razorpay verification."""

import hashlib
import hmac
import json
from datetime import timedelta

from app.core.config import get_settings
from app.core.utils import utcnow
from app.db import mongo
from app.services import plans as plans_service
from tests.helpers import error_code, resume_body, signed_up


async def _upload_record(uid: str, file_id: str) -> None:
    """A parsed upload as /files/upload stores it (inserted directly to keep the test independent of PDF parsing)."""
    await mongo.files().insert_one({
        "_id": file_id, "uid": uid, "fileName": "cv.pdf", "fileType": "pdf", "fileSize": 10, "text": "cv", "createdAt": utcnow(),
    })


async def test_free_plan_allows_one_resume(client):
    headers = await signed_up(client, "free-user")
    assert (await client.post("/api/resumes", json=resume_body("First"), headers=headers)).status_code == 201

    blocked = await client.post("/api/resumes", json=resume_body("Second"), headers=headers)
    assert blocked.status_code == 402
    assert error_code(blocked) == "PLAN_LIMIT_REACHED"
    assert set(blocked.json()["error"]["plans"]) == {"single", "monthly"}

    # Deleting doesn't give the free resume back (lifetime counter).
    resume_id = (await client.get("/api/resumes", headers=headers)).json()["data"][0]["id"]
    await client.delete(f"/api/resumes/{resume_id}", headers=headers)
    assert (await client.post("/api/resumes", json=resume_body("Third"), headers=headers)).status_code == 402

    duplicate = await client.post(f"/api/resumes/{resume_id}/duplicate", headers=headers)
    assert duplicate.status_code == 404  # deleted


async def test_uploads_count_and_save_once_per_file(client):
    headers = await signed_up(client, "uploader")
    await _upload_record("uploader", "file_one")

    saved = await client.post("/api/resumes", json=resume_body("Imported", sourceType="upload", sourceFileId="file_one"), headers=headers)
    assert saved.status_code == 201

    # The upload used the free resume, so a second upload no longer bypasses the limit.
    await _upload_record("uploader", "file_three")
    over = await client.post("/api/resumes", json=resume_body("Loophole", sourceType="upload", sourceFileId="file_three"), headers=headers)
    assert over.status_code == 402
    assert (await mongo.files().find_one({"_id": "file_three"})).get("resumeId") is None  # claim released

    await mongo.users().update_one({"_id": "uploader"}, {"$set": {"subscription.singleResumesBalance": 5}})
    reused = await client.post("/api/resumes", json=resume_body("Again", sourceType="upload", sourceFileId="file_one"), headers=headers)
    assert reused.status_code == 409

    missing = await client.post("/api/resumes", json=resume_body("No file", sourceType="upload"), headers=headers)
    assert missing.status_code == 422

    # Someone else's upload can't be claimed.
    await _upload_record("someone-else", "file_two")
    stolen = await client.post("/api/resumes", json=resume_body("Theirs", sourceType="upload", sourceFileId="file_two"), headers=headers)
    assert stolen.status_code == 409


async def test_single_credit_and_monthly_plan(client):
    headers = await signed_up(client, "buyer")
    await client.post("/api/resumes", json=resume_body("Free"), headers=headers)

    await mongo.users().update_one({"_id": "buyer"}, {"$set": {"subscription.singleResumesBalance": 1}})
    assert (await client.post("/api/resumes", json=resume_body("Credit"), headers=headers)).status_code == 201
    assert (await client.post("/api/resumes", json=resume_body("Over"), headers=headers)).status_code == 402

    await mongo.users().update_one(
        {"_id": "buyer"}, {"$set": {"subscription.plan": "monthly", "subscription.currentPeriodEnd": utcnow() + timedelta(days=10)}}
    )
    for i in range(3):
        assert (await client.post("/api/resumes", json=resume_body(f"Monthly {i}"), headers=headers)).status_code == 201
    current = (await client.get("/api/subscriptions/current", headers=headers)).json()["data"]
    assert current["plan"] == "monthly" and current["isUnlimited"] is True

    await mongo.users().update_one({"_id": "buyer"}, {"$set": {"subscription.currentPeriodEnd": utcnow() - timedelta(days=1)}})
    assert (await client.post("/api/resumes", json=resume_body("Expired"), headers=headers)).status_code == 402


def _signature(order_id: str, payment_id: str) -> str:
    return hmac.new(b"rzp_test_secret", f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


async def _order(uid: str, order_id: str, plan: str) -> None:
    await mongo.payments().insert_one(
        {"_id": order_id, "uid": uid, "plan": plan, "amount": 4900, "currency": "INR", "status": "created", "createdAt": utcnow()}
    )


async def test_payment_verification(client):
    headers = await signed_up(client, "payer")
    await _order("payer", "order_single", "single")

    bad = await client.post(
        "/api/payments/verify",
        json={"razorpayOrderId": "order_single", "razorpayPaymentId": "pay_1", "razorpaySignature": "forged"},
        headers=headers,
    )
    assert bad.status_code == 400 and error_code(bad) == "PAYMENT_VERIFICATION_FAILED"

    body = {"razorpayOrderId": "order_single", "razorpayPaymentId": "pay_1", "razorpaySignature": _signature("order_single", "pay_1")}
    good = await client.post("/api/payments/verify", json=body, headers=headers)
    assert good.status_code == 200
    assert good.json()["data"]["singleResumesBalance"] == 1

    # Verifying the same payment twice grants the plan only once.
    again = await client.post("/api/payments/verify", json=body, headers=headers)
    assert again.json()["data"]["singleResumesBalance"] == 1

    # Another user's order is invisible.
    intruder = await signed_up(client, "intruder")
    stolen = await client.post("/api/payments/verify", json=body, headers=intruder)
    assert stolen.status_code == 404


async def test_monthly_payment_extends_period(client):
    headers = await signed_up(client, "monthly-payer")
    for n in (1, 2):
        await _order("monthly-payer", f"order_m{n}", "monthly")
        body = {"razorpayOrderId": f"order_m{n}", "razorpayPaymentId": f"pay_m{n}", "razorpaySignature": _signature(f"order_m{n}", f"pay_m{n}")}
        assert (await client.post("/api/payments/verify", json=body, headers=headers)).status_code == 200

    doc = await mongo.users().find_one({"_id": "monthly-payer"})
    remaining = doc["subscription"]["currentPeriodEnd"] - utcnow()
    assert timedelta(days=59) < remaining <= timedelta(days=60)


async def test_order_creation_maps_gateway_errors(client, monkeypatch):
    headers = await signed_up(client, "gateway-user")
    from app.api import billing
    from razorpay import errors as razorpay_errors

    def bad_auth(*_args, **_kwargs):
        raise razorpay_errors.BadRequestError("Authentication failed")

    monkeypatch.setattr(billing, "_razorpay", lambda: type("C", (), {"order": type("O", (), {"create": staticmethod(bad_auth)})()})())
    auth_failed = await client.post("/api/payments/orders", json={"plan": "single"}, headers=headers)
    assert auth_failed.status_code == 401 and error_code(auth_failed) == "PAYMENT_AUTH_FAILED"

    def server_down(*_args, **_kwargs):
        raise razorpay_errors.ServerError("down")

    monkeypatch.setattr(billing, "_razorpay", lambda: type("C", (), {"order": type("O", (), {"create": staticmethod(server_down)})()})())
    gateway_down = await client.post("/api/payments/orders", json={"plan": "single"}, headers=headers)
    assert gateway_down.status_code == 500 and error_code(gateway_down) == "PAYMENT_GATEWAY_ERROR"


async def test_plans_are_public_and_editable_in_mongo(client):
    plans = (await client.get("/api/subscriptions/plans")).json()["data"]
    assert list(plans) == ["free", "single", "monthly"]
    assert plans["single"]["price"] == 49
    assert plans["monthly"]["price"] == 199 and plans["monthly"]["name"] == "Clave Pro"
    assert plans["monthly"]["features"]["jobs"] is True and plans["free"]["features"]["jobs"] is False
    assert await mongo.plans().count_documents({}) == 3  # seeded on first read

    # The documents are the source of truth: raising the free allowance takes effect immediately.
    await mongo.plans().update_one({"_id": "free"}, {"$set": {"limits.resumes": 2}})
    headers = await signed_up(client, "edited-plan")
    for name in ("One", "Two"):
        assert (await client.post("/api/resumes", json=resume_body(name), headers=headers)).status_code == 201
    assert (await client.post("/api/resumes", json=resume_body("Three"), headers=headers)).status_code == 402
    current = (await client.get("/api/subscriptions/current", headers=headers)).json()["data"]
    assert current["resumesAllowance"] == 2 and current["isPro"] is False and current["features"]["jobs"] is False


async def test_free_resumes_are_capped_per_device(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "free_resume_guard_enabled", True)
    await mongo.plans().insert_one({**next(p for p in plans_service.default_plans() if p["_id"] == "free"), "limits": {"resumes": 5}})
    laptop = "laptop-0000000000000001"

    # FREE_RESUMES_PER_DEVICE=2: two accounts on the same laptop share its two free resumes.
    first = await signed_up(client, "sibling-one")
    for name in ("A", "B"):
        response = await client.post("/api/resumes", json=resume_body(name), headers={**first, "X-Clave-Device": laptop})
        assert response.status_code == 201
    second = await signed_up(client, "sibling-two")
    blocked = await client.post("/api/resumes", json=resume_body("C"), headers={**second, "X-Clave-Device": laptop})
    assert blocked.status_code == 402 and "device" in blocked.json()["error"]["message"]

    # The AI generator's pre-check blocks before spending tokens, too.
    pre = await client.post("/api/resumes/generate", json={"targetRole": "Analyst"}, headers={**second, "X-Clave-Device": laptop})
    assert pre.status_code == 402

    # Another device on the same network (same IP in tests) is not affected.
    phone = "phone-00000000000000002"
    assert (await client.post("/api/resumes", json=resume_body("D"), headers={**second, "X-Clave-Device": phone})).status_code == 201

    claims = await mongo.free_resume_claims().find({}).to_list()
    assert len(claims) == 3 and all(len(c["deviceHash"]) == 64 and "laptop" not in c["deviceHash"] for c in claims)


def _webhook(body: dict) -> tuple[bytes, dict[str, str]]:
    raw = json.dumps(body).encode()
    return raw, {"X-Razorpay-Signature": hmac.new(b"whsec_test", raw, hashlib.sha256).hexdigest(), "Content-Type": "application/json"}


async def test_webhook_grants_pro_once(client):
    headers = await signed_up(client, "webhook-payer")
    await mongo.payments().insert_one(
        {"_id": "order_w", "uid": "webhook-payer", "plan": "monthly", "amount": 19900, "currency": "INR", "status": "created", "createdAt": utcnow()}
    )
    event = {"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_w", "order_id": "order_w", "amount": 19900}}}}
    raw, sig = _webhook(event)

    forged = await client.post("/api/payments/webhook", content=raw, headers={**sig, "X-Razorpay-Signature": "nope"})
    assert forged.status_code == 400

    assert (await client.post("/api/payments/webhook", content=raw, headers=sig)).json()["data"]["handled"] is True
    assert (await client.post("/api/payments/webhook", content=raw, headers=sig)).json()["data"]["handled"] is False  # retried event
    current = (await client.get("/api/subscriptions/current", headers=headers)).json()["data"]
    assert current["isPro"] is True and current["features"]["jobs"] is True

    # The browser's verify call arriving afterwards doesn't extend the plan a second time.
    body = {"razorpayOrderId": "order_w", "razorpayPaymentId": "pay_w", "razorpaySignature": _signature("order_w", "pay_w")}
    assert (await client.post("/api/payments/verify", json=body, headers=headers)).status_code == 200
    doc = await mongo.users().find_one({"_id": "webhook-payer"})
    assert doc["subscription"]["currentPeriodEnd"] - utcnow() <= timedelta(days=30)

    tampered, tsig = _webhook({**event, "payload": {"payment": {"entity": {"id": "pay_x", "order_id": "order_w", "amount": 100}}}})
    assert (await client.post("/api/payments/webhook", content=tampered, headers=tsig)).json()["data"]["handled"] is False
