"""In-app notifications, filtered by the user's notification settings, with optional email copies.

Categories match Settings → Notifications (jobs, resumes, applications, product). "account" notices
(security events) are always delivered. Email copies follow Settings → Email preferences:
important = account notices only, product = account + product news + job matches, none = no email.
"""

import logging
from datetime import timedelta
from typing import Any, Literal

from app.core.config import get_settings
from app.core.utils import iso, new_id, utcnow
from app.db import mongo
from app.services import email

logger = logging.getLogger(__name__)

Category = Literal["jobs", "resumes", "applications", "product", "account"]
_EMAIL_CATEGORIES = {"important": {"account"}, "product": {"account", "product", "jobs"}, "none": set()}


async def notify(uid: str, category: Category, title: str, body: str = "", link: str | None = None) -> None:
    """Best effort: a failed notification must never break the action that triggered it."""
    try:
        user = await mongo.users().find_one({"_id": uid}, {"settings": 1, "email": 1})
        if user is None:
            return
        settings = user.get("settings") or {}
        if category != "account" and not (settings.get("notifications") or {}).get(category, True):
            return
        now = utcnow()
        await mongo.notifications().insert_one({
            "_id": new_id("ntf_"),
            "uid": uid,
            "category": category,
            "title": title,
            "body": body,
            "link": link,
            "read": False,
            "createdAt": now,
            "expireAt": now + timedelta(days=get_settings().notification_retention_days),
        })
        if category in _EMAIL_CATEGORIES.get(settings.get("emailPreference", "important"), set()):
            url = f"{get_settings().web_base_url.rstrip('/')}{link}" if link else get_settings().web_base_url
            await email.send(user.get("email", ""), f"Clave: {title}", f"{title}\n\n{body}\n\n{url}\n\nManage notifications in Clave → Settings.")
    except Exception:
        logger.exception("Could not create notification for %s", uid)


def view(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": doc["_id"],
        "category": doc["category"],
        "title": doc["title"],
        "body": doc.get("body", ""),
        "link": doc.get("link"),
        "read": bool(doc.get("read")),
        "createdAt": iso(doc.get("createdAt")),
    }
