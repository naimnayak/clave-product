"""Account endpoints: sync after sign-in, /me, onboarding, settings, security, sessions, export and deletion."""

import asyncio
import json
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from pydantic import Field

from app.core.errors import ApiError
from app.core.security import CurrentUser, delete_firebase_user, firebase_login_info, get_current_user
from app.core.utils import iso, ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel, ShortText
from app.schemas.settings import UserSettings
from app.services import accounts, sessions, storage
from app.services.notifications import notify

router = APIRouter(tags=["Account"])

# Photos are data URLs from ChangePhotoModal, which scales them to 256px JPEG (typically 20-60 KB).
_AVATAR_DATA_URL = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$")
_MAX_AVATAR_CHARS = 400_000


class SyncRequest(CamelModel):
    name: ShortText | None = None


class AccountUpdate(CamelModel):
    name: ShortText | None = None
    avatar_url: str | None = Field(default=None, max_length=_MAX_AVATAR_CHARS)


@router.post("/auth/sync")
async def sync_account(payload: SyncRequest | None = None, user: CurrentUser = Depends(get_current_user)):
    """Called by the frontend right after every Firebase sign-in or sign-up."""
    doc, created = await accounts.ensure_user(user, payload.name if payload else None)
    if created:
        await notify(user.uid, "product", "Welcome to Clave", "Set up your Career Profile, then create your first resume.", "/profile")
    public = accounts.public_user(doc)
    return ok({"user": public, "onboardingComplete": public["onboardingComplete"], "isNewUser": created})


@router.get("/me")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    return ok(accounts.public_user(await accounts.get_user_doc(user)))


@router.put("/me")
async def update_me(payload: AccountUpdate, user: CurrentUser = Depends(get_current_user)):
    updates: dict = {}
    if payload.name is not None:
        if not payload.name.strip():
            raise ApiError(422, "VALIDATION_ERROR", "Name can't be empty.", [{"field": "name", "message": "Required"}])
        updates["name"] = payload.name.strip()
    if "avatar_url" in payload.model_fields_set:
        avatar = (payload.avatar_url or "").strip()
        if avatar and not (_AVATAR_DATA_URL.match(avatar) or avatar.startswith("https://")):
            raise ApiError(422, "VALIDATION_ERROR", "Photo must be a PNG, JPEG, WebP or GIF image.")
        updates["avatarUrl"] = avatar or None
    if updates:
        updates["updatedAt"] = utcnow()
        await accounts.get_user_doc(user)
        await mongo.users().update_one({"_id": user.uid}, {"$set": updates})
    return ok(accounts.public_user(await accounts.get_user_doc(user)), "Account updated")


@router.post("/me/onboarding")
async def complete_onboarding(user: CurrentUser = Depends(get_current_user)):
    await accounts.get_user_doc(user)
    await mongo.users().update_one({"_id": user.uid}, {"$set": {"onboardingComplete": True, "updatedAt": utcnow()}})
    return ok({"onboardingComplete": True})


@router.get("/me/settings")
async def get_settings_endpoint(user: CurrentUser = Depends(get_current_user)):
    doc = await accounts.get_user_doc(user)
    return ok(UserSettings.model_validate(doc.get("settings") or {}).dump())


@router.put("/me/settings")
async def update_settings(payload: UserSettings, user: CurrentUser = Depends(get_current_user)):
    await accounts.get_user_doc(user)
    await mongo.users().update_one({"_id": user.uid}, {"$set": {"settings": payload.dump(), "updatedAt": utcnow()}})
    return ok(payload.dump(), "Settings saved")


# ─── Security & sessions ─────────────────────────────────────────────────────────


@router.get("/me/security")
async def get_security(request: Request, user: CurrentUser = Depends(get_current_user)):
    info = await asyncio.to_thread(firebase_login_info, user.uid)
    updated_ms = info["passwordUpdatedAt"]
    return ok({
        "providers": info["providers"],
        "passwordUpdatedAt": iso(datetime.fromtimestamp(updated_ms / 1000, UTC)) if updated_ms else None,
        "emailVerified": user.email_verified,
        "sessions": await sessions.list_for(user.uid, getattr(request.state, "session_id", None)),
    })


@router.post("/me/security/password-changed")
async def password_changed(user: CurrentUser = Depends(get_current_user)):
    """The password itself changes in Firebase; this records the security notice."""
    await notify(user.uid, "account", "Your password was changed", "If this wasn't you, reset your password right away and contact support.", "/account")
    return ok({"notified": True})


@router.delete("/me/sessions/{session_id}", status_code=204)
async def revoke_session(session_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    if session_id == getattr(request.state, "session_id", None):
        raise ApiError(400, "BAD_REQUEST", "Use Log out to end the session on this device.")
    await sessions.revoke(user.uid, session_id)
    return Response(status_code=204)


@router.post("/me/sessions/revoke-others")
async def revoke_other_sessions(request: Request, user: CurrentUser = Depends(get_current_user)):
    count = await sessions.revoke_others(user.uid, getattr(request.state, "session_id", None))
    if count:
        await notify(user.uid, "account", "Signed out of other devices", f"{count} other session{'s' if count != 1 else ''} ended.", "/account")
    return ok({"revoked": count})


@router.post("/auth/logout")
async def logout(request: Request, user: CurrentUser = Depends(get_current_user)):
    sid = getattr(request.state, "session_id", None)
    if sid:
        await sessions.revoke(user.uid, sid)
    return ok({"loggedOut": True})


# ─── Data export & deletion ──────────────────────────────────────────────────────


def _clean(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k not in {"uid", "data", "text", "objectName"}}
    for key, value in list(out.items()):
        if isinstance(value, datetime):
            out[key] = iso(value)
    return out


@router.get("/me/export")
async def export_data(user: CurrentUser = Depends(get_current_user)):
    """Everything Clave stores about the user, as a downloadable JSON file."""
    uid = user.uid
    account = await accounts.get_user_doc(user)

    async def collect(collection, query: dict) -> list[dict]:
        return [_clean(doc) async for doc in collection.find(query)]

    profile = await mongo.profiles().find_one({"_id": uid})
    payload = {
        "exportedAt": iso(utcnow()),
        "account": accounts.public_user(account) | {"settings": account.get("settings"), "subscription": _clean(account.get("subscription") or {}), "usage": account.get("usage")},
        "careerProfile": (profile or {}).get("data"),
        "resumes": await collect(mongo.resumes(), {"uid": uid}),
        "savedJobs": await collect(mongo.saved_jobs(), {"uid": uid}),
        "applications": await collect(mongo.applications(), {"uid": uid}),
        "interviewSessions": await collect(mongo.interview_sessions(), {"uid": uid}),
        "jobDescriptions": await collect(mongo.job_descriptions(), {"uid": uid}),
        "assistantConversations": await collect(mongo.chat_sessions(), {"uid": uid}),
        "assistantMemory": await collect(mongo.user_memory(), {"_id": uid}),
        "notifications": await collect(mongo.notifications(), {"uid": uid}),
        "uploads": await collect(mongo.files(), {"uid": uid}),
        "payments": await collect(mongo.payments(), {"uid": uid}),
        "feedback": await collect(mongo.feedback(), {"uid": uid}),
        "sessions": await collect(mongo.sessions(), {"uid": uid}),
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    filename = f"clave-data-{utcnow().strftime('%Y-%m-%d')}.json"
    return Response(body, media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.delete("/me", status_code=204)
async def delete_me(user: CurrentUser = Depends(get_current_user)):
    """Deletes the user's data and their login. Payment records are kept for accounting (see the Privacy Policy)."""
    uid = user.uid
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
        # Device claims hold only salted hashes; they are detached from the user but kept, so deleting and
        # re-creating an account doesn't reset the device's free-resume allowance.
        mongo.free_resume_claims().update_many({"uid": uid}, {"$set": {"uid": None}}),
    )
    await mongo.users().delete_one({"_id": uid})
    await asyncio.to_thread(delete_firebase_user, uid)
    return Response(status_code=204)
