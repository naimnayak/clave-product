"""Resume allowance (Free / Single credit / Monthly), upload exemption and Razorpay verification."""

import hashlib
import hmac
from datetime import timedelta

from app.core.utils import utcnow
from app.db import mongo
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


async def test_uploads_are_free_once_per_file(client):
    headers = await signed_up(client, "uploader")
    await client.post("/api/resumes", json=resume_body("Uses the free one"), headers=headers)
    await _upload_record("uploader", "file_one")

    saved = await client.post("/api/resumes", json=resume_body("Imported", sourceType="upload", sourceFileId="file_one"), headers=headers)
    assert saved.status_code == 201

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


async def test_plans_are_public(client):
    plans = (await client.get("/api/subscriptions/plans")).json()["data"]
    assert plans["single"]["price"] == 49
    assert plans["monthly"]["price"] == 199
