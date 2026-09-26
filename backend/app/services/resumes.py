"""Resume persistence shared by the resumes, files and jobs routers."""

from typing import Any

from fastapi import Request

from app.core.errors import not_found
from app.core.utils import drop_none, iso, new_id, utcnow
from app.db import mongo
from app.schemas.resume import ResumeDocumentIn
from app.services import quota
from app.services.accounts import track_usage
from app.services.ats import compute_ats
from app.services.notifications import notify


def summary(doc: dict[str, Any]) -> dict[str, Any]:
    """src/types/resume.ts `Resume`, plus template/source metadata from the API contract."""
    return drop_none({
        "id": doc["_id"],
        "name": doc.get("name", ""),
        "targetRole": doc.get("targetRole", ""),
        "template": doc.get("template", "classic"),
        "atsScore": int(doc.get("atsScore", 0)),
        "type": doc.get("type", "base"),
        "tailoredFor": doc.get("tailoredFor") or None,
        "status": doc.get("status") or None,
        "sourceType": doc.get("sourceType", "manual"),
        "sourceResumeId": doc.get("sourceResumeId") or None,
        "createdAt": iso(doc.get("createdAt")),
        "updatedAt": iso(doc.get("updatedAt")),
    })


def document(doc: dict[str, Any]) -> dict[str, Any]:
    """src/types/resumeDocument.ts `ResumeDocument` plus the summary metadata."""
    return {**summary(doc), "sectionOrder": doc.get("sectionOrder", []), "content": doc.get("content", {})}


def normalize(fields: dict[str, Any]) -> dict[str, Any]:
    """Runs AI- or client-produced documents through the schema before storage."""
    return ResumeDocumentIn.model_validate(fields).dump()


async def get_owned(uid: str, resume_id: str) -> dict[str, Any]:
    doc = await mongo.resumes().find_one({"_id": resume_id, "uid": uid})
    if doc is None:
        raise not_found("Resume")
    return doc


async def create(
    uid: str,
    fields: dict[str, Any],
    *,
    resume_type: str = "base",
    source_type: str = "manual",
    source_resume_id: str | None = None,
    tailored_for: str | None = None,
    status: str | None = None,
    request: Request | None = None,
    consume_credit: bool = True,
) -> dict[str, Any]:
    """Saves a new resume. Everything except a user's own uploaded resume counts against their plan."""
    body = normalize(fields)
    if consume_credit:
        await quota.consume_resume_credit(uid, request)
    else:
        await track_usage(uid, "uploadsSaved")
    now = utcnow()
    doc = {
        "_id": new_id("res_"),
        "uid": uid,
        **body,
        "atsScore": compute_ats(body)["total"],
        "type": resume_type,
        "sourceType": source_type,
        "sourceResumeId": source_resume_id,
        "tailoredFor": tailored_for,
        "status": status,
        "createdAt": now,
        "updatedAt": now,
    }
    await mongo.resumes().insert_one(doc)
    if resume_type == "tailored":
        await track_usage(uid, "tailorings")
    if source_type in {"ai", "tailored", "upload"}:
        what = {"ai": "Your AI resume is ready", "tailored": "Your tailored resume is ready", "upload": "Your uploaded resume is ready"}[source_type]
        await notify(uid, "resumes", what, f"“{doc['name']}” is saved in your resume library.", f"/resumes/{doc['_id']}/edit")
    return doc
