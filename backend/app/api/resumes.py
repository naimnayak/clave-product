"""Resume library, builder persistence and the AI resume flows (analyze job, generate, tailor, ATS)."""

import copy

from fastapi import APIRouter, Depends, Request, Response
from pydantic import Field
from pymongo import ReturnDocument

from app.api.deps import AI_LIMIT, ai_action, stored_profile
from app.core.errors import ApiError
from app.core.limiter import limiter
from app.core.security import CurrentUser, get_current_user
from app.core.utils import ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel, LongText, ShortText, Tags
from app.schemas.profile import ProfileData
from app.schemas.resume import JobDescriptionInput, ResumeCreate, ResumeDocumentIn, ResumePatch, TemplateId
from app.schemas.settings import UserSettings
from app.services import ai_tasks, job_descriptions, quota
from app.services import resume_logic as rl
from app.services import resumes as resume_store
from app.services.accounts import get_user_doc, track_usage
from app.services.ats import compute_ats

router = APIRouter(tags=["Resumes"])


async def _remember_jd(uid: str, text: str, source: job_descriptions.Source, keywords: list[str], title: str = "", company: str = "") -> None:
    """Saves the job description for job matching; a new one also starts a Pro job search."""
    doc = await job_descriptions.save(uid, text, source=source, keywords=keywords, title=title, company=company)
    await job_descriptions.after_save(uid, doc)


class AnalyzeJobRequest(CamelModel):
    target_role: ShortText = Field(min_length=1)
    job_description: LongText = ""
    # Accepted for contract compatibility; the stored Career Profile wins when it exists.
    career_profile: ProfileData | None = None


class JobAnalysisIn(CamelModel):
    key_requirements: Tags = []
    matched_skills: Tags = []
    gaps: Tags = []


class GenerateRequest(CamelModel):
    target_role: ShortText = Field(min_length=1)
    industry: ShortText = ""
    job_description: LongText = ""
    attempt: int = Field(default=0, ge=0, le=20)
    template: TemplateId | None = None
    job_analysis: JobAnalysisIn | None = None


class TailorRequest(CamelModel):
    job_title: ShortText = ""
    company: ShortText = ""
    job_description: LongText = Field(min_length=1)


# ─── Library & builder ───────────────────────────────────────────────────────────


@router.get("/resumes")
async def list_resumes(user: CurrentUser = Depends(get_current_user)):
    cursor = mongo.resumes().find({"uid": user.uid}, {"content": 0}).sort("updatedAt", -1)
    return ok([resume_store.summary(doc) async for doc in cursor])


async def _claim_upload(uid: str, file_id: str | None) -> str:
    """Each uploaded file can be saved as a resume once. It counts against the plan like any other resume."""
    if not file_id:
        raise ApiError(422, "VALIDATION_ERROR", "Uploaded resumes need the file they came from.", [{"field": "sourceFileId", "message": "Required"}])
    claimed = await mongo.files().find_one_and_update(
        {"_id": file_id, "uid": uid, "resumeId": {"$exists": False}}, {"$set": {"resumeId": "pending"}}
    )
    if claimed is None:
        raise ApiError(409, "CONFLICT", "This upload was already saved as a resume, or it has expired. Upload the file again.")
    return file_id


@router.post("/resumes", status_code=201)
async def create_resume(request: Request, payload: ResumeCreate, user: CurrentUser = Depends(get_current_user)):
    if payload.source_resume_id:
        await resume_store.get_owned(user.uid, payload.source_resume_id)
    is_upload = payload.source_type == "upload"
    file_id = await _claim_upload(user.uid, payload.source_file_id) if is_upload else None
    fields = ResumeDocumentIn.model_validate(payload.model_dump()).dump()
    try:
        doc = await resume_store.create(
            user.uid,
            fields,
            resume_type=payload.type,
            source_type=payload.source_type,
            source_resume_id=payload.source_resume_id,
            tailored_for=payload.tailored_for,
            status=payload.status,
            request=request,
        )
    except Exception:
        if file_id:
            await mongo.files().update_one({"_id": file_id, "uid": user.uid}, {"$unset": {"resumeId": ""}})
        raise
    if file_id:
        await mongo.files().update_one({"_id": file_id, "uid": user.uid}, {"$set": {"resumeId": doc["_id"]}})
    return ok(resume_store.document(doc), "Resume created")


@router.post("/resumes/analyze-job")
@limiter.limit(AI_LIMIT)
async def analyze_job(request: Request, payload: AnalyzeJobRequest, user: CurrentUser = Depends(get_current_user)):
    profile = await stored_profile(user.uid) or (payload.career_profile.dump() if payload.career_profile else {})
    result = await ai_action(user.uid, lambda: ai_tasks.analyze_job(payload.target_role, payload.job_description, profile))
    await track_usage(user.uid, "aiGenerations")
    await _remember_jd(user.uid, payload.job_description, "analyze", result["keyRequirements"], result["role"], result["company"])
    return ok(result)


@router.post("/resumes/generate")
@limiter.limit(AI_LIMIT)
async def generate_resume(request: Request, payload: GenerateRequest, user: CurrentUser = Depends(get_current_user)):
    """Returns an unsaved draft; the frontend saves it with POST /resumes when the user opens it."""
    await quota.assert_can_create(user.uid, request)
    user_doc = await get_user_doc(user)
    profile = await stored_profile(user.uid) or {}
    settings = UserSettings.model_validate(user_doc.get("settings") or {})
    result = await ai_action(
        user.uid,
        lambda: ai_tasks.generate_resume(
            profile,
            role=payload.target_role.strip(),
            industry=payload.industry,
            job_description=payload.job_description,
            attempt=payload.attempt,
            analysis=payload.job_analysis.dump() if payload.job_analysis else None,
            name=user_doc.get("name", ""),
            email=user_doc.get("email", ""),
            template=payload.template or settings.default_template,
        ),
    )
    result["doc"] = {**result["doc"], **resume_store.normalize(result["doc"])}
    await track_usage(user.uid, "aiGenerations")
    if payload.job_description.strip():
        keywords = payload.job_analysis.key_requirements if payload.job_analysis else result.get("keywords") or []
        await _remember_jd(user.uid, payload.job_description, "generate", keywords, payload.target_role)
    return ok(result)


@router.get("/resumes/{resume_id}")
async def get_resume(resume_id: str, user: CurrentUser = Depends(get_current_user)):
    return ok(resume_store.document(await resume_store.get_owned(user.uid, resume_id)))


@router.put("/resumes/{resume_id}")
async def update_resume(resume_id: str, payload: ResumeDocumentIn, user: CurrentUser = Depends(get_current_user)):
    await resume_store.get_owned(user.uid, resume_id)
    body = payload.dump()
    updated = await mongo.resumes().find_one_and_update(
        {"_id": resume_id, "uid": user.uid},
        {"$set": {**body, "atsScore": compute_ats(body)["total"], "updatedAt": utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    return ok(resume_store.summary(updated), "Resume saved")


@router.patch("/resumes/{resume_id}")
async def patch_resume(resume_id: str, payload: ResumePatch, user: CurrentUser = Depends(get_current_user)):
    doc = await resume_store.get_owned(user.uid, resume_id)
    changes = payload.model_dump(by_alias=True, exclude_unset=True)
    unset = {}
    if changes.get("status") == "ready":
        changes.pop("status")
        unset["status"] = ""
    if "targetRole" in changes:
        doc["targetRole"] = changes["targetRole"]
        changes["atsScore"] = compute_ats(doc)["total"]
    update: dict = {"$set": {**changes, "updatedAt": utcnow()}}
    if unset:
        update["$unset"] = unset
    updated = await mongo.resumes().find_one_and_update({"_id": resume_id, "uid": user.uid}, update, return_document=ReturnDocument.AFTER)
    return ok(resume_store.summary(updated), "Resume updated")


@router.delete("/resumes/{resume_id}", status_code=204)
async def delete_resume(resume_id: str, user: CurrentUser = Depends(get_current_user)):
    await resume_store.get_owned(user.uid, resume_id)
    await mongo.resumes().delete_one({"_id": resume_id, "uid": user.uid})
    return Response(status_code=204)


@router.post("/resumes/{resume_id}/duplicate", status_code=201)
async def duplicate_resume(request: Request, resume_id: str, user: CurrentUser = Depends(get_current_user)):
    original = await resume_store.get_owned(user.uid, resume_id)
    fields = {**resume_store.document(original), "name": f"{original.get('name', 'Resume')} (Copy)"}
    doc = await resume_store.create(
        user.uid,
        fields,
        resume_type=original.get("type", "base"),
        source_type="duplicate",
        source_resume_id=resume_id,
        tailored_for=original.get("tailoredFor"),
        request=request,
    )
    return ok(resume_store.document(doc), "Resume duplicated")


# ─── Tailoring & ATS ─────────────────────────────────────────────────────────────


@router.post("/resumes/{resume_id}/tailor/analyze")
@limiter.limit(AI_LIMIT)
async def tailor_analyze(request: Request, resume_id: str, payload: TailorRequest, user: CurrentUser = Depends(get_current_user)):
    """Suggested changes for the Tailor flow's review step. Nothing is saved; the original stays untouched."""
    doc = resume_store.document(await resume_store.get_owned(user.uid, resume_id))
    result = await ai_action(
        user.uid,
        lambda: ai_tasks.tailor_analysis(doc, job_title=payload.job_title, company=payload.company, job_description=payload.job_description),
    )
    await track_usage(user.uid, "aiGenerations")
    await _remember_jd(user.uid, payload.job_description, "tailor", result["keywords"]["all"], result["jobTitle"], result["company"])
    return ok(result)


@router.post("/resumes/{resume_id}/tailor", status_code=201)
@limiter.limit(AI_LIMIT)
async def tailor_resume(request: Request, resume_id: str, payload: TailorRequest, user: CurrentUser = Depends(get_current_user)):
    """One-shot tailoring: applies the safe suggestions and saves a NEW resume that references the original."""
    await quota.assert_can_create(user.uid, request)
    original = resume_store.document(await resume_store.get_owned(user.uid, resume_id))
    analysis = await ai_action(
        user.uid,
        lambda: ai_tasks.tailor_analysis(original, job_title=payload.job_title, company=payload.company, job_description=payload.job_description),
    )
    tailored = copy.deepcopy(original)
    for change in analysis["changes"]:
        # Adding skills needs the candidate's confirmation, so the one-shot path never does it.
        if change["patch"]["op"] != "addSkills":
            rl.apply_patch(tailored, change["patch"])
    label = analysis["company"] or analysis["jobTitle"]
    tailored["name"] = f"{original['name']} · {label}" if label else f"{original['name']} (Tailored)"
    doc = await resume_store.create(
        user.uid,
        tailored,
        resume_type="tailored",
        source_type="tailored",
        source_resume_id=resume_id,
        tailored_for=analysis["company"] or None,
        request=request,
    )
    await _remember_jd(user.uid, payload.job_description, "tailor", analysis["keywords"]["all"], analysis["jobTitle"], analysis["company"])
    return ok({**resume_store.document(doc), "analysis": analysis}, "Resume tailored successfully")


@router.post("/resumes/{resume_id}/analyze")
@limiter.limit(AI_LIMIT)
async def ats_analyze(request: Request, resume_id: str, payload: JobDescriptionInput, user: CurrentUser = Depends(get_current_user)):
    doc = resume_store.document(await resume_store.get_owned(user.uid, resume_id))
    result = await ai_action(user.uid, lambda: ai_tasks.ats_analysis(doc, payload.job_description))
    await mongo.resumes().update_one(
        {"_id": resume_id, "uid": user.uid},
        {"$set": {"lastAtsAnalysis": {**result, "analyzedAt": utcnow()}}},
    )
    await track_usage(user.uid, "atsAnalyses")
    await _remember_jd(user.uid, payload.job_description, "ats", result.pop("jobKeywords", []), result.pop("jobTitle", ""), result.pop("company", ""))
    return ok(result)
