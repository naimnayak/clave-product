"""Job descriptions the user has submitted, used to personalise job matching and the assistant."""

from fastapi import APIRouter, Depends, Query, Response

from app.core.errors import not_found
from app.core.security import CurrentUser, get_current_user
from app.core.utils import ok
from app.db import mongo
from app.services import job_descriptions

router = APIRouter(tags=["Job descriptions"])


@router.get("/job-descriptions")
async def list_job_descriptions(user: CurrentUser = Depends(get_current_user), limit: int = Query(20, ge=1, le=100)):
    cursor = mongo.job_descriptions().find({"uid": user.uid}, {"text": 0}).sort("lastUsedAt", -1).limit(limit)
    return ok([job_descriptions.view(doc) async for doc in cursor])


@router.get("/job-descriptions/{jd_id}")
async def get_job_description(jd_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await mongo.job_descriptions().find_one({"_id": jd_id, "uid": user.uid})
    if doc is None:
        raise not_found("Job description")
    return ok(job_descriptions.view(doc, include_text=True))


@router.delete("/job-descriptions/{jd_id}", status_code=204)
async def delete_job_description(jd_id: str, user: CurrentUser = Depends(get_current_user)):
    await mongo.job_descriptions().delete_one({"_id": jd_id, "uid": user.uid})
    return Response(status_code=204)
