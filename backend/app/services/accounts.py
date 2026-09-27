"""User documents: account record, plan/usage state and settings, keyed by Firebase uid (`_id`)."""

import asyncio
from typing import Any

from pymongo import ReturnDocument

from app.core.security import CurrentUser, delete_firebase_user
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
    from app.services.admin import role_of  # admin imports security, which this module also uses

    return {
        "role": role_of(doc),
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


async def delete_account(uid: str) -> None:
    """Deletes a user's data and their Firebase login (self-service or from the admin panel).

    Payment records are kept for accounting (see the Privacy Policy). Device claims hold only salted
    hashes; they are detached from the user but kept, so re-creating an account doesn't reset the
    device's free-resume allowance.
    """
    from app.services import storage  # storage imports settings-heavy clients; keep module import light

    await storage.delete_user_objects(uid)
    await asyncio.gather(
        mongo.resumes().delete_many({"uid": uid}),
        mongo.profiles().delete_many({"_id": uid}),
        mongo.files().delete_many({"uid": uid}),
        mongo.saved_jobs().delete_many({"uid": uid}),
        mongo.applications().delete_many({"uid": uid}),
        mongo.notifications().delete_many({"uid": uid}),
        mongo.sessions().delete_many({"uid": uid}),
        mongo.ai_usage().delete_many({"uid": uid}),
        mongo.feedback().delete_many({"uid": uid}),
        mongo.interview_sessions().delete_many({"uid": uid}),
        mongo.job_descriptions().delete_many({"uid": uid}),
        mongo.chat_sessions().delete_many({"uid": uid}),
        mongo.user_memory().delete_many({"_id": uid}),
        mongo.job_feed_usage().delete_many({"uid": uid}),
        mongo.admin_notes().delete_many({"uid": uid}),
        mongo.free_resume_claims().update_many({"uid": uid}, {"$set": {"uid": None}}),
    )
    await mongo.users().delete_one({"_id": uid})
    await asyncio.to_thread(delete_firebase_user, uid)


async def track_usage(uid: str, field: str, amount: int = 1) -> None:
    await mongo.users().update_one({"_id": uid}, {"$inc": {f"usage.{field}": amount}})
