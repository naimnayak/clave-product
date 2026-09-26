"""Resume uploads (PDF/DOCX, 10 MB) and AI parsing into a ResumeDocument or a Career Profile draft."""

import asyncio
import re

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile

from app.api.deps import AI_LIMIT, ai_action
from app.core.config import get_settings
from app.core.errors import ApiError, not_found
from app.core.limiter import limiter
from app.core.security import CurrentUser, get_current_user
from app.core.utils import new_id, ok, utcnow
from app.db import mongo
from app.schemas.profile import ProfileData
from app.services import ai_tasks, storage
from app.services import resumes as resume_store
from app.services.accounts import get_user_doc, track_usage
from app.services.ats import compute_ats
from app.services.documents import detect_file_type, extract_text

router = APIRouter(tags=["Files"])


def _safe_name(name: str | None) -> str:
    base = re.split(r"[\\/]", name or "")[-1].strip()
    return re.sub(r"[^\w .()\-]", "_", base)[:200] or "resume"


async def _owned_file(uid: str, file_id: str) -> dict:
    doc = await mongo.files().find_one({"_id": file_id, "uid": uid})
    if doc is None:
        raise not_found("File")
    return doc


async def _parse(uid: str, doc: dict) -> ai_tasks.ParsedResume:
    pdf_bytes = await storage.get(doc) if doc.get("fileType") == "pdf" else None
    if not (doc.get("text") or "").strip() and pdf_bytes is None:
        raise ApiError(400, "UNREADABLE_FILE", "We couldn't find any text in this file.")
    return await ai_action(uid, lambda: ai_tasks.parse_resume(text=doc.get("text") or "", pdf_bytes=pdf_bytes))


@router.post("/files/upload", status_code=201)
async def upload_file(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    limit = get_settings().max_upload_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise ApiError(400, "FILE_TOO_LARGE", f"File exceeds the {limit // (1024 * 1024)} MB limit.")
    if not data:
        raise ApiError(400, "EMPTY_FILE", "This file looks empty. Try a different one.")

    name = _safe_name(file.filename)
    file_type = detect_file_type(data, name)
    text = await asyncio.to_thread(extract_text, data, file_type)
    file_id = new_id("file_")
    content_type = "application/pdf" if file_type == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    stored = await storage.put(user.uid, file_id, data, content_type)
    doc = {
        "_id": file_id,
        "uid": user.uid,
        "fileName": name,
        "fileType": file_type,
        "fileSize": len(data),
        **stored,
        "text": text,
        "createdAt": utcnow(),
    }
    await mongo.files().insert_one(doc)
    return ok(
        {"fileId": doc["_id"], "fileName": name, "fileSize": len(data), "fileType": file_type, "status": "ready"},
        "File uploaded",
    )


@router.post("/files/{file_id}/parse-resume")
@limiter.limit(AI_LIMIT)
async def parse_resume(request: Request, file_id: str, user: CurrentUser = Depends(get_current_user)):
    """Structured ResumeDocument for review. Nothing is saved until the frontend creates the resume."""
    doc = await _owned_file(user.uid, file_id)
    parsed = await _parse(user.uid, doc)
    account = await get_user_doc(user)
    document = ai_tasks.parsed_to_document(parsed, doc["fileName"])
    contact = document["content"]["contact"]
    contact["name"] = contact["name"] or account.get("name", "")
    contact["email"] = contact["email"] or account.get("email", "")
    document = {**document, **resume_store.normalize(document)}
    await track_usage(user.uid, "parses")
    return ok({
        "fileId": file_id,
        "targetRole": document["targetRole"],
        "name": document["name"],
        "document": document,
        "atsScore": compute_ats(document)["total"],
    })


@router.post("/files/{file_id}/parse-profile")
@limiter.limit(AI_LIMIT)
async def parse_profile(request: Request, file_id: str, user: CurrentUser = Depends(get_current_user)):
    """Career Profile draft for onboarding review. Does not overwrite the saved profile."""
    doc = await _owned_file(user.uid, file_id)
    parsed = await _parse(user.uid, doc)
    account = await get_user_doc(user)
    profile = ai_tasks.parsed_to_profile(parsed, name=account.get("name", ""), email=account.get("email", ""))
    await track_usage(user.uid, "parses")
    return ok(ProfileData.model_validate(profile).dump())


@router.delete("/files/{file_id}", status_code=204)
async def delete_file(file_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await _owned_file(user.uid, file_id)
    await storage.delete(doc)
    await mongo.files().delete_one({"_id": file_id, "uid": user.uid})
    return Response(status_code=204)
