"""Signed-in devices. The web app sends a random per-browser id in `X-Clave-Session`.

Firebase doesn't expose sessions, so Clave tracks them itself. Revoking a session makes every
Clave API call from that browser fail with SESSION_REVOKED, which signs that browser out.
"""

import re
from datetime import timedelta

from fastapi import Request
from pymongo.errors import DuplicateKeyError

from app.core.errors import ApiError
from app.core.utils import iso, utcnow
from app.db import mongo

HEADER = "x-clave-session"
_VALID_ID = re.compile(r"^[A-Za-z0-9-]{16,64}$")
_TOUCH_EVERY = timedelta(minutes=5)
_KEEP_FOR = timedelta(days=60)

_BROWSERS = [("Edg/", "Edge"), ("OPR/", "Opera"), ("Brave", "Brave"), ("Firefox/", "Firefox"), ("Chrome/", "Chrome"), ("Safari/", "Safari")]
_SYSTEMS = [("iPhone", "iPhone"), ("iPad", "iPad"), ("Android", "Android"), ("Windows", "Windows"), ("Mac OS X", "Mac"), ("CrOS", "ChromeOS"), ("Linux", "Linux")]


def describe_device(user_agent: str) -> str:
    browser = next((name for token, name in _BROWSERS if token in user_agent), "Browser")
    system = next((name for token, name in _SYSTEMS if token in user_agent), "")
    return f"{browser} on {system}" if system else browser


def session_id(request: Request) -> str | None:
    sid = (request.headers.get(HEADER) or "").strip()
    return sid if _VALID_ID.match(sid) else None


async def check_and_touch(uid: str, request: Request) -> str | None:
    """Rejects revoked sessions and keeps `lastActiveAt` fresh (at most one write per 5 minutes)."""
    sid = session_id(request)
    if sid is None:
        return None
    key = f"{uid}:{sid}"
    now = utcnow()
    doc = await mongo.sessions().find_one({"_id": key}, {"revoked": 1, "lastActiveAt": 1})
    if doc and doc.get("revoked"):
        raise ApiError(401, "SESSION_REVOKED", "You were signed out on this device. Please sign in again.")
    if doc is None:
        try:
            await mongo.sessions().insert_one({
                "_id": key, "uid": uid, "sid": sid,
                "device": describe_device(request.headers.get("user-agent", "")),
                "createdAt": now, "lastActiveAt": now, "revoked": False, "expireAt": now + _KEEP_FOR,
            })
        except DuplicateKeyError:
            pass  # two parallel first requests from the same browser
    elif now - doc["lastActiveAt"] > _TOUCH_EVERY:
        await mongo.sessions().update_one({"_id": key}, {"$set": {"lastActiveAt": now, "expireAt": now + _KEEP_FOR}})
    return sid


async def list_for(uid: str, current_sid: str | None) -> list[dict]:
    cursor = mongo.sessions().find({"uid": uid, "revoked": False}).sort("lastActiveAt", -1).limit(20)
    return [
        {
            "id": doc["sid"],
            "device": doc.get("device") or "Browser",
            "lastActive": iso(doc.get("lastActiveAt")),
            "createdAt": iso(doc.get("createdAt")),
            "current": doc["sid"] == current_sid,
        }
        async for doc in cursor
    ]


async def revoke(uid: str, sid: str) -> None:
    await mongo.sessions().update_one({"_id": f"{uid}:{sid}"}, {"$set": {"revoked": True}})


async def revoke_others(uid: str, current_sid: str | None) -> int:
    result = await mongo.sessions().update_many({"uid": uid, "sid": {"$ne": current_sid}, "revoked": False}, {"$set": {"revoked": True}})
    return result.modified_count
