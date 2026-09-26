"""Application tracking for the Jobs page tabs (Applied, Interviewing, Rejected)."""

from typing import Literal

from fastapi import APIRouter, Depends, Response
from pymongo import ReturnDocument

from app.core.errors import not_found
from app.core.security import CurrentUser, get_current_user
from app.core.utils import iso, ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel, Text
from app.services.notifications import notify

router = APIRouter(tags=["Applications"])

Status = Literal["applied", "interviewing", "rejected"]
_LABELS = {"applied": "Applied", "interviewing": "Interviewing", "rejected": "Not selected"}


class ApplicationUpdate(CamelModel):
    status: Status
    notes: Text | None = None


def _view(doc: dict) -> dict:
    return {
        "jobId": doc["jobId"],
        "status": doc["status"],
        "title": doc.get("title", ""),
        "company": doc.get("company", ""),
        "notes": doc.get("notes", ""),
        "appliedAt": iso(doc.get("appliedAt")),
        "updatedAt": iso(doc.get("updatedAt")),
    }


@router.get("/applications")
async def list_applications(user: CurrentUser = Depends(get_current_user)):
    cursor = mongo.applications().find({"uid": user.uid}).sort("updatedAt", -1)
    return ok([_view(doc) async for doc in cursor])


@router.put("/applications/{job_id}")
async def upsert_application(job_id: str, payload: ApplicationUpdate, user: CurrentUser = Depends(get_current_user)):
    """Marks a job as applied, or moves it to another stage. Creating the first time records the application date."""
    job = await mongo.jobs().find_one({"_id": job_id}, {"title": 1, "company": 1})
    if job is None:
        raise not_found("Job")
    now = utcnow()
    previous = await mongo.applications().find_one({"uid": user.uid, "jobId": job_id}, {"status": 1})
    updates: dict = {"status": payload.status, "updatedAt": now, "title": job.get("title", ""), "company": job.get("company", "")}
    if payload.notes is not None:
        updates["notes"] = payload.notes.strip()
    doc = await mongo.applications().find_one_and_update(
        {"uid": user.uid, "jobId": job_id},
        {"$set": updates, "$setOnInsert": {"appliedAt": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if previous is None or previous.get("status") != payload.status:
        await notify(
            user.uid,
            "applications",
            f"{job.get('title', 'Job')} at {job.get('company', '')}: {_LABELS[payload.status]}",
            "Your application tracker was updated.",
            f"/jobs?view={payload.status}",
        )
    return ok(_view(doc), "Application updated")


@router.delete("/applications/{job_id}", status_code=204)
async def delete_application(job_id: str, user: CurrentUser = Depends(get_current_user)):
    await mongo.applications().delete_one({"uid": user.uid, "jobId": job_id})
    return Response(status_code=204)
