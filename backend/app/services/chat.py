"""Career assistant sessions and long-term memory.

- A session is one continuous conversation stored server-side (`chat_sessions`), so it carries on across
  days and devices. It stays open for CHAT_SESSION_HOURS (48 by default) after it starts.
- When a session starts, a snapshot of everything useful about the user (profile, latest resume, recent
  job descriptions, applications, saved jobs, plan and long-term memory) is stored with it and sent with
  every turn, so the assistant "knows" the user from the first message.
- When a session closes (48 hours passed, or the user starts a new chat), the AI merges its key points
  into `user_memory`, and the transcript is deleted.
- Settings -> Privacy -> Personalize AI off: no personal data in the snapshot and no memory is kept.
"""

import json
import logging
from datetime import timedelta
from typing import Any

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.utils import iso, new_id, utcnow
from app.db import mongo
from app.services import ai_tasks, job_descriptions, plans
from app.services.ai_client import AIResponseError, AIUnavailableError

logger = logging.getLogger(__name__)

_PROFILE_KEYS = (
    "name", "location", "preferredLocations", "targetRoles", "experienceLevel", "workModes", "industries", "summary",
    "skills", "experience", "education", "projects", "certifications", "achievements",
)
_CONTEXT_LIMIT = 14_000
_PURGE_GRACE = timedelta(days=3)  # transcripts are deleted by TTL even if summarising keeps failing


def personalize_enabled(user_doc: dict[str, Any]) -> bool:
    return bool(((user_doc.get("settings") or {}).get("privacy") or {}).get("personalizeAi", True))


def _resume_view(doc: dict[str, Any]) -> dict[str, Any]:
    content = doc.get("content") or {}
    skills = content.get("skills") or {}
    return {
        "name": doc.get("name", ""),
        "targetRole": doc.get("targetRole", ""),
        "atsScore": doc.get("atsScore"),
        "summary": (content.get("summary") or "")[:800],
        "skills": [*skills.get("technical", []), *skills.get("tools", []), *skills.get("other", [])][:40],
        "experience": [
            {"title": e.get("title", ""), "company": e.get("company", ""), "dates": f"{e.get('start', '')}–{e.get('end', '')}".strip("–")}
            for e in (content.get("experience") or [])[:6]
        ],
        "projects": [{"name": p.get("name", ""), "tech": (p.get("tech") or [])[:8]} for p in (content.get("projects") or [])[:5]],
        "education": [{"degree": e.get("degree", ""), "institution": e.get("institution", "")} for e in (content.get("education") or [])[:3]],
        "lastAtsAnalysis": {
            k: (doc.get("lastAtsAnalysis") or {}).get(k) for k in ("score", "summary", "missingKeywords")
        } if doc.get("lastAtsAnalysis") else None,
    }


async def build_context(uid: str, user_doc: dict[str, Any]) -> tuple[str, bool]:
    """The user snapshot sent with a session's turns. Returns (json_text, personalized)."""
    plan = "Clave Pro" if plans.is_pro(user_doc.get("subscription")) else "Free"
    base: dict[str, Any] = {"firstName": (user_doc.get("name") or "").split(" ")[0], "plan": plan, "today": utcnow().strftime("%Y-%m-%d")}
    if not personalize_enabled(user_doc):
        return json.dumps(base, ensure_ascii=False), False

    profile = ((await mongo.profiles().find_one({"_id": uid})) or {}).get("data") or {}
    resumes = [doc async for doc in mongo.resumes().find({"uid": uid}).sort("updatedAt", -1).limit(3)]
    jds = await job_descriptions.recent(uid, 3)
    applications = [doc async for doc in mongo.applications().find({"uid": uid}).sort("updatedAt", -1).limit(10)]
    saved_ids = [doc["jobId"] async for doc in mongo.saved_jobs().find({"uid": uid}).sort("savedAt", -1).limit(5)]
    saved = [doc async for doc in mongo.jobs().find({"_id": {"$in": saved_ids}}, {"title": 1, "company": 1})] if saved_ids else []
    interviews = [doc async for doc in mongo.interview_sessions().find({"uid": uid}, {"role": 1, "answers.evaluation.score": 1, "createdAt": 1}).sort("createdAt", -1).limit(3)]
    memory = await mongo.user_memory().find_one({"_id": uid})

    context = {
        **base,
        "careerProfile": {k: profile[k] for k in _PROFILE_KEYS if profile.get(k)},
        "latestResume": _resume_view(resumes[0]) if resumes else None,
        "otherResumes": [{"name": r.get("name", ""), "targetRole": r.get("targetRole", ""), "type": r.get("type", "base")} for r in resumes[1:]],
        "recentJobDescriptions": [{"title": j.get("title", ""), "company": j.get("company", ""), "keywords": (j.get("keywords") or [])[:12]} for j in jds],
        "applications": [{"title": a.get("title", ""), "company": a.get("company", ""), "status": a.get("status"), "updated": iso(a.get("updatedAt"))} for a in applications],
        "savedJobs": [{"title": j.get("title", ""), "company": j.get("company", "")} for j in saved],
        "mockInterviews": [
            {"role": i.get("role", ""), "scores": [a["evaluation"]["score"] for a in i.get("answers") or [] if a.get("evaluation")], "date": iso(i.get("createdAt"))}
            for i in interviews
        ],
        "memoryFromPastConversations": {"summary": memory.get("summary", ""), "facts": memory.get("facts") or []} if memory else None,
    }
    text = json.dumps({k: v for k, v in context.items() if v not in (None, [], {})}, ensure_ascii=False, default=str)
    if len(text) > _CONTEXT_LIMIT and context.get("careerProfile"):
        # Drop the bulkiest part first; the resume already carries the essentials.
        context["careerProfile"] = {k: v for k, v in context["careerProfile"].items() if k not in {"experience", "projects"}}
        text = json.dumps({k: v for k, v in context.items() if v not in (None, [], {})}, ensure_ascii=False, default=str)
    return text[:_CONTEXT_LIMIT], True


def view(session: dict[str, Any] | None) -> dict[str, Any] | None:
    if not session:
        return None
    return {
        "id": session["_id"],
        "messages": [
            {"id": m["id"], "role": m["role"], "content": m["content"], "suggestions": m.get("suggestions") or [], "createdAt": iso(m.get("at"))}
            for m in session.get("messages") or []
        ],
        "personalized": bool(session.get("personalized")),
        "createdAt": iso(session.get("createdAt")),
        "closesAt": iso(session.get("closesAt")),
    }


async def active_session(uid: str) -> dict[str, Any] | None:
    """The user's open session, closing it first if its time is up."""
    session = await mongo.chat_sessions().find_one({"uid": uid, "status": "active"})
    if session and session["closesAt"] <= utcnow():
        await close(session)
        return None
    return session


async def get_or_create(uid: str, user_doc: dict[str, Any]) -> dict[str, Any]:
    session = await active_session(uid)
    if session:
        return session
    context, personalized = await build_context(uid, user_doc)
    now = utcnow()
    closes = now + timedelta(hours=get_settings().chat_session_hours)
    doc = {
        "_id": new_id("chat_"),
        "uid": uid,
        "status": "active",
        "messages": [],
        "context": context,
        "personalized": personalized,
        "createdAt": now,
        "lastMessageAt": now,
        "closesAt": closes,
        "purgeAt": closes + _PURGE_GRACE,
    }
    try:
        await mongo.chat_sessions().insert_one(doc)
        return doc
    except DuplicateKeyError:  # a concurrent request created it first
        return await mongo.chat_sessions().find_one({"uid": uid, "status": "active"}) or doc


async def append_turn(session: dict[str, Any], message: str, reply: dict[str, Any]) -> dict[str, Any]:
    now = utcnow()
    turns = [
        {"id": new_id("m_"), "role": "user", "content": message, "at": now},
        {"id": new_id("m_"), "role": "assistant", "content": reply["reply"], "suggestions": reply.get("suggestedActions") or [], "at": now},
    ]
    updated = await mongo.chat_sessions().find_one_and_update(
        {"_id": session["_id"], "uid": session["uid"]},
        {"$push": {"messages": {"$each": turns, "$slice": -200}}, "$set": {"lastMessageAt": now}},
        return_document=ReturnDocument.AFTER,
    )
    return updated or {**session, "messages": [*session.get("messages", []), *turns]}


def history(session: dict[str, Any]) -> list[dict[str, str]]:
    turns = get_settings().chat_history_turns
    return [{"role": m["role"], "content": m["content"]} for m in (session.get("messages") or [])[-turns:]]


async def close(session: dict[str, Any]) -> bool:
    """Ends a session: saves its key points to memory, then deletes the transcript.

    Returns False when summarising failed; the session is then left `closing` and retried by
    close_due_sessions() (the purgeAt TTL deletes it after a few days regardless).
    """
    claimed = await mongo.chat_sessions().find_one_and_update(
        {"_id": session["_id"], "status": {"$in": ["active", "closing"]}},
        {"$set": {"status": "closing", "closesAt": min(session["closesAt"], utcnow())}},
        return_document=ReturnDocument.AFTER,
    )
    if claimed is None:
        return True
    uid = claimed["uid"]
    user_doc = await mongo.users().find_one({"_id": uid}, {"settings": 1}) or {}
    messages = claimed.get("messages") or []
    if claimed.get("personalized") and personalize_enabled(user_doc) and len(messages) >= 2:
        existing = await mongo.user_memory().find_one({"_id": uid})
        try:
            memory = await ai_tasks.summarize_memory([{"role": m["role"], "content": m["content"]} for m in messages], existing)
        except (AIUnavailableError, AIResponseError) as exc:
            logger.warning("Could not summarise chat %s: %s", claimed["_id"], exc)
            return False
        await mongo.user_memory().update_one(
            {"_id": uid},
            {"$set": {**memory, "updatedAt": utcnow()}, "$inc": {"sessionsSummarized": 1}, "$setOnInsert": {"createdAt": utcnow()}},
            upsert=True,
        )
    await mongo.chat_sessions().delete_one({"_id": claimed["_id"]})
    return True


async def close_due_sessions(limit: int = 50) -> int:
    """Maintenance: closes sessions whose 48 hours are up (and retries ones that failed to summarise)."""
    closed = 0
    cursor = mongo.chat_sessions().find({"status": {"$in": ["active", "closing"]}, "closesAt": {"$lte": utcnow()}}).limit(limit)
    async for session in cursor:
        closed += int(await close(session))
    return closed


async def memory_view(uid: str) -> dict[str, Any]:
    doc = await mongo.user_memory().find_one({"_id": uid}) or {}
    return {"facts": doc.get("facts") or [], "summary": doc.get("summary", ""), "updatedAt": iso(doc.get("updatedAt"))}
