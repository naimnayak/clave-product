"""Job descriptions users submit (ATS analysis, tailoring, AI generation, job analysis).

Each distinct JD is saved once per user (keyed by a hash of its normalised text) with the keywords the
AI extracted from it. Re-using a JD bumps `lastUsedAt`, so the newest JD always ranks first for job
matching. A new JD also triggers a job search for Pro users (services/job_feed.py).
"""

import hashlib
import logging
import re
from typing import Any, Literal

from pymongo import ReturnDocument

from app.core.utils import iso, new_id, utcnow
from app.db import mongo
from app.services import resume_logic as rl

logger = logging.getLogger(__name__)

Source = Literal["ats", "tailor", "generate", "analyze"]
MIN_LENGTH = 80  # shorter text is a role name or a stray paste, not a job description
MAX_STORED = 12_000
RECENT_FOR_MATCHING = 5


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


async def save(
    uid: str,
    text: str,
    *,
    source: Source,
    keywords: list[str],
    title: str = "",
    company: str = "",
) -> dict[str, Any] | None:
    """Saves or refreshes a JD. Returns the document, with `isNew` set when it was first seen now."""
    normalised = _normalise(text)
    if len(normalised) < MIN_LENGTH:
        return None
    digest = hashlib.sha256(normalised.encode()).hexdigest()
    now = utcnow()
    try:
        before = await mongo.job_descriptions().find_one_and_update(
            {"uid": uid, "hash": digest},
            {
                "$set": {"lastUsedAt": now, "lastSource": source},
                "$inc": {"useCount": 1},
                "$setOnInsert": {"_id": new_id("jd_"), "text": text.strip()[:MAX_STORED], "createdAt": now},
            },
            upsert=True,
            return_document=ReturnDocument.BEFORE,
        )
        # Keep the richest title/company/keywords seen for this JD.
        updates: dict[str, Any] = {}
        if title.strip():
            updates["title"] = title.strip()[:200]
        if company.strip():
            updates["company"] = company.strip()[:200]
        merged = rl.dedupe([*keywords, *((before or {}).get("keywords") or [])], 20)
        if merged:
            updates["keywords"] = merged
        query = {"uid": uid, "hash": digest}
        doc = (
            await mongo.job_descriptions().find_one_and_update(query, {"$set": updates}, return_document=ReturnDocument.AFTER)
            if updates
            else await mongo.job_descriptions().find_one(query)
        )
    except Exception:  # saving a JD must never break the AI feature that received it
        logger.exception("Could not save job description for %s", uid)
        return None
    if doc is None:
        return None
    doc["isNew"] = before is None
    return doc


async def recent(uid: str, limit: int = RECENT_FOR_MATCHING) -> list[dict[str, Any]]:
    cursor = mongo.job_descriptions().find({"uid": uid}, {"text": 0}).sort("lastUsedAt", -1).limit(limit)
    return [doc async for doc in cursor]


def view(doc: dict[str, Any], *, include_text: bool = False) -> dict[str, Any]:
    data = {
        "id": doc["_id"],
        "title": doc.get("title", ""),
        "company": doc.get("company", ""),
        "keywords": doc.get("keywords") or [],
        "source": doc.get("lastSource", ""),
        "useCount": int(doc.get("useCount", 1)),
        "createdAt": iso(doc.get("createdAt")),
        "lastUsedAt": iso(doc.get("lastUsedAt")),
    }
    if include_text:
        data["text"] = doc.get("text", "")
    return data


async def after_save(uid: str, doc: dict[str, Any] | None) -> None:
    """A JD the user hasn't used before starts a job search for it (Pro only, within the monthly budget)."""
    if doc and doc.get("isNew"):
        from app.services import job_feed

        job_feed.refresh_in_background(uid, "jd", jd_id=doc["_id"])
