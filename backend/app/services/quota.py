"""Plan entitlements and server-side resume quota (developer-handoff/07-SUBSCRIPTION-USAGE.md).

Free: 1 resume (lifetime counter, so deleting and re-creating does not reset it).
Single Resume (₹49): +1 credit per purchase. Monthly Unlimited (₹199): unlimited while the period is active.
"""

from datetime import datetime, timedelta
from typing import Any

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.utils import iso, utcnow
from app.db import mongo
from app.services import free_resume_guard


def plan_catalog() -> dict[str, Any]:
    settings = get_settings()
    return {
        "free": {"name": "Free", "price": 0, "currency": "INR", "description": f"{settings.free_resume_limit} resume, forever free"},
        "single": {
            "name": "Single Resume",
            "price": settings.single_resume_price_inr,
            "currency": "INR",
            "description": f"₹{settings.single_resume_price_inr} per resume",
        },
        "monthly": {
            "name": "Monthly Unlimited",
            "price": settings.monthly_price_inr,
            "currency": "INR",
            "description": f"₹{settings.monthly_price_inr} per month",
        },
    }


def _monthly_active(subscription: dict[str, Any]) -> bool:
    end: datetime | None = subscription.get("currentPeriodEnd")
    return subscription.get("plan") == "monthly" and end is not None and end > utcnow()


def entitlements(user_doc: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    subscription = user_doc.get("subscription") or {}
    created = int((user_doc.get("usage") or {}).get("resumesCreated", 0))
    balance = int(subscription.get("singleResumesBalance", 0))
    unlimited = _monthly_active(subscription)
    allowance = settings.free_resume_limit
    can_create = (not settings.enforce_plan_limits) or unlimited or created < allowance or balance > 0
    return {
        "plan": "monthly" if unlimited else "free",
        "status": "active" if unlimited or subscription.get("plan") != "monthly" else "expired",
        "currentPeriodEnd": iso(subscription.get("currentPeriodEnd")),
        "resumesCreated": created,
        "resumesAllowance": allowance,
        "singleResumesBalance": balance,
        "isUnlimited": unlimited,
        "canCreateResume": can_create,
        "limitsEnforced": settings.enforce_plan_limits,
    }


def plan_limit_error() -> ApiError:
    settings = get_settings()
    return ApiError(
        402,
        "PLAN_LIMIT_REACHED",
        f"You have used your free allowance of {settings.free_resume_limit} resume. "
        "Upgrade or buy a single resume credit to create more.",
        plans={k: v for k, v in plan_catalog().items() if k != "free"},
    )


async def assert_can_create(uid: str) -> None:
    """Cheap pre-check before spending AI tokens on something the user cannot save."""
    doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1, "usage": 1})
    if not entitlements(doc or {})["canCreateResume"]:
        raise plan_limit_error()


async def consume_resume_credit(uid: str, request: Request | None = None) -> str:
    """Atomically records a resume creation against the user's plan. Returns what was used."""
    settings = get_settings()
    users = mongo.users()
    inc = {"$inc": {"usage.resumesCreated": 1}}

    if not settings.enforce_plan_limits:
        await users.update_one({"_id": uid}, inc)
        return "unenforced"

    now = utcnow()
    if await users.find_one_and_update(
        {"_id": uid, "subscription.plan": "monthly", "subscription.currentPeriodEnd": {"$gt": now}}, inc
    ):
        return "monthly"

    guard = None
    if request is not None and settings.free_resume_guard_enabled:
        guard = await free_resume_guard.evaluate(request, uid)

    if not (guard and guard.blocked) and await users.find_one_and_update(
        {"_id": uid, "$or": [{"usage.resumesCreated": {"$lt": settings.free_resume_limit}}, {"usage.resumesCreated": {"$exists": False}}]},
        inc,
    ):
        if guard:
            await free_resume_guard.record(uid, guard)
        return "free"

    if await users.find_one_and_update(
        {"_id": uid, "subscription.singleResumesBalance": {"$gt": 0}},
        {"$inc": {"usage.resumesCreated": 1, "subscription.singleResumesBalance": -1}},
    ):
        return "credit"

    raise plan_limit_error()


# ─── Daily AI actions ───────────────────────────────────────────────────────────


def _ai_key(uid: str) -> str:
    return f"{uid}:{utcnow().strftime('%Y-%m-%d')}"


async def ai_daily_status(uid: str) -> dict[str, Any]:
    settings = get_settings()
    doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1})
    paid = _monthly_active((doc or {}).get("subscription") or {})
    limit = settings.ai_daily_limit_paid if paid else settings.ai_daily_limit_free
    usage = await mongo.ai_usage().find_one({"_id": _ai_key(uid)})
    return {"limit": limit, "used": int((usage or {}).get("count", 0))}


async def consume_ai_action(uid: str) -> None:
    """Counts one AI action for today and blocks once the plan's daily allowance is used up."""
    status = await ai_daily_status(uid)
    if status["used"] >= status["limit"]:
        raise ApiError(
            429,
            "AI_DAILY_LIMIT_REACHED",
            f"You've used today's {status['limit']} AI actions. They reset at midnight UTC"
            + ("." if status["limit"] > get_settings().ai_daily_limit_free else ", or upgrade for more."),
        )
    now = utcnow()
    await mongo.ai_usage().update_one(
        {"_id": _ai_key(uid)},
        {"$inc": {"count": 1}, "$setOnInsert": {"uid": uid, "expireAt": now + timedelta(days=2)}},
        upsert=True,
    )


async def refund_ai_action(uid: str) -> None:
    """Failed AI calls don't count against the allowance."""
    await mongo.ai_usage().update_one({"_id": _ai_key(uid), "count": {"$gt": 0}}, {"$inc": {"count": -1}})
