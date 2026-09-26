"""User documents: account record, plan/usage state and settings, keyed by Firebase uid (`_id`)."""

from typing import Any

from pymongo import ReturnDocument

from app.core.security import CurrentUser
from app.core.utils import iso, utcnow
from app.db import mongo
from app.schemas.settings import UserSettings


def default_subscription() -> dict[str, Any]:
    return {"plan": "free", "status": "active", "currentPeriodEnd": None, "singleResumesBalance": 0}


async def ensure_user(user: CurrentUser, name: str | None = None) -> tuple[dict[str, Any], bool]:
    """Creates the user record on first sign-in and refreshes identity fields afterwards."""
    now = utcnow()
    display_name = (name or "").strip() or user.name or user.email.split("@")[0]
    existing = await mongo.users().find_one({"_id": user.uid})
    updates: dict[str, Any] = {
        "email": user.email,
        "emailVerified": user.email_verified,
        "provider": user.provider,
        "lastLoginAt": now,
    }
    on_insert: dict[str, Any] = {
        "name": display_name,
        "avatarUrl": user.picture,
        "onboardingComplete": False,
        "createdAt": now,
        "updatedAt": now,
        "settings": UserSettings().dump(),
        "subscription": default_subscription(),
        "usage": {"resumesCreated": 0, "aiGenerations": 0, "tailorings": 0, "atsAnalyses": 0, "parses": 0},
    }
    if existing and name and name.strip() and not existing.get("name"):
        # A field may not appear in both $set and $setOnInsert.
        updates["name"] = name.strip()
        on_insert.pop("name")
    doc = await mongo.users().find_one_and_update(
        {"_id": user.uid},
        {"$set": updates, "$setOnInsert": on_insert},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc, existing is None


async def get_user_doc(user: CurrentUser) -> dict[str, Any]:
    doc = await mongo.users().find_one({"_id": user.uid})
    if doc is None:
        doc, _ = await ensure_user(user)
    return doc


def public_user(doc: dict[str, Any]) -> dict[str, Any]:
    """Shape of src/types/user.ts plus account metadata."""
    return {
        "id": doc["_id"],
        "name": doc.get("name") or "",
        "email": doc.get("email") or "",
        "avatarUrl": doc.get("avatarUrl") or None,
        "emailVerified": bool(doc.get("emailVerified")),
        "provider": doc.get("provider") or "password",
        "onboardingComplete": bool(doc.get("onboardingComplete")),
        "isActive": True,
        "createdAt": iso(doc.get("createdAt")),
        "updatedAt": iso(doc.get("updatedAt")),
    }


async def track_usage(uid: str, field: str, amount: int = 1) -> None:
    await mongo.users().update_one({"_id": uid}, {"$inc": {f"usage.{field}": amount}})
