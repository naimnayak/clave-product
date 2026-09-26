"""Subscription status and Razorpay payments (adapted from the ATS backend to the ₹49 / ₹199 Clave plans).

Security fix over the ATS version: the plan is read from the order stored at creation time, never from
the client's verify request, so a cheaper order cannot be redeemed for a more expensive plan.
"""

import asyncio
import hashlib
import hmac
import logging
from datetime import timedelta
from typing import Literal

import razorpay
from fastapi import APIRouter, Depends
from pydantic import Field
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.errors import ApiError, not_found
from app.core.security import CurrentUser, get_current_user
from app.core.utils import ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel
from app.services.accounts import get_user_doc
from app.services.quota import entitlements, plan_catalog

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Subscriptions"])


class CreateOrderRequest(CamelModel):
    plan: Literal["single", "monthly"]


class VerifyPaymentRequest(CamelModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)


def _razorpay() -> razorpay.Client:
    settings = get_settings()
    if not (settings.razorpay_key_id and settings.razorpay_key_secret):
        raise ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Payments are not available yet.")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


@router.get("/subscriptions/plans")
async def list_plans():
    return ok(plan_catalog())


@router.get("/subscriptions/current")
async def current_subscription(user: CurrentUser = Depends(get_current_user)):
    return ok(entitlements(await get_user_doc(user)))


@router.post("/payments/orders", status_code=201)
async def create_order(payload: CreateOrderRequest, user: CurrentUser = Depends(get_current_user)):
    client = _razorpay()
    plan = plan_catalog()[payload.plan]
    amount = int(plan["price"]) * 100  # paise
    try:
        order = await asyncio.to_thread(
            client.order.create,
            {"amount": amount, "currency": "INR", "receipt": f"{user.uid[:20]}_{payload.plan}", "notes": {"uid": user.uid, "plan": payload.plan}},
        )
    except Exception as exc:  # the SDK raises several error types
        logger.error("Razorpay order creation failed: %s", exc)
        raise ApiError(502, "PAYMENT_GATEWAY_ERROR", "Payment gateway error. Please try again.") from exc

    await mongo.payments().insert_one(
        {"_id": order["id"], "uid": user.uid, "plan": payload.plan, "amount": amount, "currency": "INR", "status": "created", "createdAt": utcnow()}
    )
    return ok({"orderId": order["id"], "amount": amount, "currency": "INR", "keyId": get_settings().razorpay_key_id, "plan": payload.plan})


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

    try:
        claimed = await mongo.payments().find_one_and_update(
            {"_id": order["_id"], "status": "created"},
            {"$set": {"status": "paid", "paymentId": payload.razorpay_payment_id, "paidAt": utcnow()}},
        )
    except DuplicateKeyError as exc:
        raise ApiError(409, "CONFLICT", "This payment was already used.") from exc

    if claimed is not None:  # first verification of this order: grant the plan exactly once
        if order["plan"] == "single":
            await mongo.users().update_one({"_id": user.uid}, {"$inc": {"subscription.singleResumesBalance": 1}})
        else:
            doc = await get_user_doc(user)
            current_end = (doc.get("subscription") or {}).get("currentPeriodEnd")
            start = max(current_end, utcnow()) if current_end else utcnow()
            await mongo.users().update_one(
                {"_id": user.uid},
                {"$set": {"subscription.plan": "monthly", "subscription.status": "active",
                          "subscription.currentPeriodEnd": start + timedelta(days=settings.monthly_plan_days)}},
            )
    return ok(entitlements(await get_user_doc(user)), "Payment verified")
