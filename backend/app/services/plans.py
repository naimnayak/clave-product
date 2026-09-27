"""Plan catalog stored in the `plans` collection.

Defaults come from settings and are inserted the first time a plan is read. After that the MongoDB
documents are the source of truth, so prices, limits and features can be changed without a deploy.
A `null` limit means unlimited.

Plan ids are stable identifiers used in payments and subscriptions: `free`, `single` (a one-off
resume credit) and `monthly` (Clave Pro).
"""

from typing import Any

from app.core.config import get_settings
from app.core.utils import utcnow
from app.db import mongo

PRO_PLAN = "monthly"


def default_plans() -> list[dict[str, Any]]:
    s = get_settings()
    return [
        {
            "_id": "free",
            "name": "Free",
            "price": 0,
            "currency": "INR",
            "interval": None,
            "description": f"{s.free_resume_limit} resumes, forever free",
            "sortOrder": 0,
            "limits": {
                "resumes": s.free_resume_limit,
                "aiDaily": s.ai_daily_limit_free,
                "chatDaily": s.chat_daily_limit_free,
                "mockInterviews": s.free_mock_interviews,
            },
            "features": {"jobs": False, "jobPreview": True, "chatMemory": True},
            "active": True,
        },
        {
            "_id": "single",
            "name": "Single Resume",
            "price": s.single_resume_price_inr,
            "currency": "INR",
            "interval": "one_time",
            "description": f"₹{s.single_resume_price_inr} for one more resume",
            "sortOrder": 1,
            "grants": {"resumeCredits": 1},
            "active": True,
        },
        {
            "_id": PRO_PLAN,
            "name": "Clave Pro",
            "price": s.monthly_price_inr,
            "currency": "INR",
            "interval": "month",
            "periodDays": s.monthly_plan_days,
            "description": f"₹{s.monthly_price_inr} per month",
            "sortOrder": 2,
            "limits": {"resumes": None, "aiDaily": s.ai_daily_limit_paid, "chatDaily": s.chat_daily_limit_paid, "mockInterviews": None},
            "features": {"jobs": True, "jobPreview": True, "chatMemory": True},
            "active": True,
        },
    ]


async def all_plans() -> dict[str, dict[str, Any]]:
    """Every plan keyed by id, seeding any that are missing."""
    found = {doc["_id"]: doc async for doc in mongo.plans().find({})}
    for plan in default_plans():
        if plan["_id"] not in found:
            now = utcnow()
            # Upsert so concurrent first reads don't race each other.
            await mongo.plans().update_one({"_id": plan["_id"]}, {"$setOnInsert": {**plan, "createdAt": now, "updatedAt": now}}, upsert=True)
            found[plan["_id"]] = plan
    return found


async def get_plan(plan_id: str) -> dict[str, Any]:
    return (await all_plans())[plan_id]


def public_view(plan: dict[str, Any]) -> dict[str, Any]:
    view = {k: v for k, v in plan.items() if k not in {"_id", "createdAt", "updatedAt", "active", "sortOrder"}}
    return {"id": plan["_id"], **view}


async def public_catalog() -> dict[str, dict[str, Any]]:
    plans = await all_plans()
    ordered = sorted((p for p in plans.values() if p.get("active", True)), key=lambda p: p.get("sortOrder", 0))
    return {p["_id"]: public_view(p) for p in ordered}


def is_pro(subscription: dict[str, Any] | None) -> bool:
    subscription = subscription or {}
    end = subscription.get("currentPeriodEnd")
    return subscription.get("plan") == PRO_PLAN and end is not None and end > utcnow()


async def plan_for(user_doc: dict[str, Any] | None) -> dict[str, Any]:
    """The plan whose limits apply to this user right now (Pro while active, otherwise Free)."""
    return await get_plan(PRO_PLAN if is_pro((user_doc or {}).get("subscription")) else "free")


def limit(plan: dict[str, Any], key: str) -> int | None:
    return (plan.get("limits") or {}).get(key)


def feature(plan: dict[str, Any], key: str) -> bool:
    return bool((plan.get("features") or {}).get(key))
