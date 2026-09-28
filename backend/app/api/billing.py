"""Plans, subscription status and Razorpay payments.

Flow: POST /payments/orders creates a Razorpay order for a plan -> the frontend opens Razorpay Checkout
-> POST /payments/verify checks the checkout signature and grants the plan. POST /payments/webhook
(Razorpay dashboard -> Webhooks, events `payment.captured` and `order.paid`) grants it too, for
payments whose browser closed before verify ran. Granting is idempotent: whichever arrives first
flips the order from `created` to `paid`, and only that call grants the plan.

The plan and amount are read from the order stored at creation time, never from the client.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import timedelta
from typing import Any, Literal

import razorpay
from fastapi import APIRouter, Depends, Request
from razorpay import errors as razorpay_errors
from pydantic import Field
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.errors import ApiError, not_found
from app.core.security import CurrentUser, get_current_user
from app.core.utils import ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel
from app.services import plans
from app.services.accounts import get_user_doc
from app.services.notifications import notify
from app.services.quota import entitlements

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Subscriptions"])


class CreateOrderRequest(CamelModel):
    plan: Literal["single", "monthly"]


class VerifyPaymentRequest(CamelModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)


MIN_AMOUNT_PAISE = 100  # Razorpay's own floor


def _razorpay() -> razorpay.Client:
    settings = get_settings()
    if not (settings.razorpay_key_id and settings.razorpay_key_secret):
        raise ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Payments are not available yet.")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def _order_error(exc: Exception) -> ApiError:
    """Maps the Razorpay SDK's exception types to HTTP status codes for order creation."""
    if isinstance(exc, razorpay_errors.BadRequestError):
        # The SDK also raises this for bad credentials (Razorpay reuses BAD_REQUEST_ERROR for auth).
        message = str(exc)
        if "key_id" in message.lower() or "authentication" in message.lower():
            return ApiError(401, "PAYMENT_AUTH_FAILED", "Payment gateway rejected our credentials.")
        return ApiError(400, "BAD_REQUEST", message or "Razorpay rejected this order request.")
    return ApiError(500, "PAYMENT_GATEWAY_ERROR", "Payment gateway error. Please try again.")


@router.get("/subscriptions/plans")
async def list_plans():
    return ok(await plans.public_catalog())


@router.get("/subscriptions/current")
async def current_subscription(user: CurrentUser = Depends(get_current_user)):
    return ok(await entitlements(await get_user_doc(user)))


@router.post("/payments/orders", status_code=201)
async def create_order(payload: CreateOrderRequest, user: CurrentUser = Depends(get_current_user)):
    client = _razorpay()
    plan = await plans.get_plan(payload.plan)
    if not plan.get("active", True):
        raise ApiError(409, "CONFLICT", "This plan is not available right now.")
    amount = int(plan["price"]) * 100  # paise
    if amount < MIN_AMOUNT_PAISE:
        # Not reachable with the current plan prices (min ₹49); guards any future plan misconfiguration.
        raise ApiError(400, "BAD_REQUEST", f"Order amount must be at least {MIN_AMOUNT_PAISE} paise.")
    try:
        order = await asyncio.to_thread(
            client.order.create,
            {"amount": amount, "currency": "INR", "receipt": f"{user.uid[:20]}_{payload.plan}", "notes": {"uid": user.uid, "plan": payload.plan}},
        )
    except Exception as exc:  # the SDK raises several error types
        logger.error("Razorpay order creation failed: %s", exc)
        raise _order_error(exc) from exc

    await mongo.payments().insert_one(
        {"_id": order["id"], "uid": user.uid, "plan": payload.plan, "amount": amount, "currency": "INR", "status": "created", "createdAt": utcnow()}
    )
    return ok({
        "orderId": order["id"],
        "amount": amount,
        "currency": "INR",
        "keyId": get_settings().razorpay_key_id,
        "plan": payload.plan,
        "planName": plan.get("name", ""),
        "prefill": {"name": user.name or "", "email": user.email},
    })


async def _grant(order: dict[str, Any]) -> None:
    uid = order["uid"]
    if order["plan"] == "single":
        await mongo.users().update_one({"_id": uid}, {"$inc": {"subscription.singleResumesBalance": 1}})
        await notify(uid, "account", "Resume credit added", "You can create one more resume.", "/resumes")
        return
    plan = await plans.get_plan(order["plan"])
    doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1}) or {}
    current_end = (doc.get("subscription") or {}).get("currentPeriodEnd")
    start = max(current_end, utcnow()) if current_end else utcnow()
    days = int(plan.get("periodDays") or get_settings().monthly_plan_days)
    await mongo.users().update_one(
        {"_id": uid},
        {"$set": {"subscription.plan": plans.PRO_PLAN, "subscription.status": "active", "subscription.currentPeriodEnd": start + timedelta(days=days)}},
    )
    await notify(uid, "account", "Welcome to Clave Pro", "Your personal job feed is being prepared.", "/jobs")
    from app.services import job_feed  # imported here: job_feed depends on this module's siblings

    job_feed.refresh_in_background(uid, "upgrade")


async def _fulfil(order: dict[str, Any], payment_id: str) -> bool:
    """Marks the order paid and grants its plan exactly once. Returns True when this call granted it."""
    try:
        claimed = await mongo.payments().find_one_and_update(
            {"_id": order["_id"], "status": "created"},
            {"$set": {"status": "paid", "paymentId": payment_id, "paidAt": utcnow()}},
        )
    except DuplicateKeyError as exc:
        raise ApiError(409, "CONFLICT", "This payment was already used.") from exc
    if claimed is None:
        return False
    await _grant(order)
    return True


@router.post("/payments/verify")
async def verify_payment(payload: VerifyPaymentRequest, user: CurrentUser = Depends(get_current_user)):
    settings = get_settings()
    _razorpay()  # raises when payments are not configured
    order = await mongo.payments().find_one({"_id": payload.razorpay_order_id, "uid": user.uid})
    if order is None:
        raise not_found("Order")

    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise ApiError(400, "PAYMENT_VERIFICATION_FAILED", "Payment verification failed.")

    await _fulfil(order, payload.razorpay_payment_id)
    return ok(await entitlements(await get_user_doc(user)), "Payment verified")


@router.post("/payments/webhook", include_in_schema=False)
async def razorpay_webhook(request: Request):
    """Razorpay server-to-server events, authenticated by the webhook signature (no user token)."""
    secret = get_settings().razorpay_webhook_secret
    if not secret:
        raise ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Webhook secret is not configured.")
    body = await request.body()
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("x-razorpay-signature", "")):
        raise ApiError(400, "PAYMENT_VERIFICATION_FAILED", "Invalid webhook signature.")

    try:
        event = json.loads(body)
    except ValueError as exc:
        raise ApiError(400, "BAD_REQUEST", "Invalid webhook body.") from exc
    if event.get("event") not in {"payment.captured", "order.paid"}:
        return ok({"handled": False})

    payment = ((event.get("payload") or {}).get("payment") or {}).get("entity") or {}
    order_id = payment.get("order_id") or (((event.get("payload") or {}).get("order") or {}).get("entity") or {}).get("id")
    order = await mongo.payments().find_one({"_id": order_id}) if order_id else None
    if order is None or not payment.get("id"):
        logger.warning("Razorpay webhook for unknown order %s", order_id)
        return ok({"handled": False})  # 2xx so Razorpay doesn't retry something we can never match
    if int(payment.get("amount") or 0) != int(order["amount"]):
        logger.error("Razorpay webhook amount mismatch for order %s", order_id)
        return ok({"handled": False})
    return ok({"handled": await _fulfil(order, payment["id"])})
