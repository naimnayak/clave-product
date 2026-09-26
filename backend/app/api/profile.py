"""Career Profile, the source of truth that every resume is generated from."""

from fastapi import APIRouter, Depends

from app.api.deps import stored_profile
from app.core.security import CurrentUser, get_current_user
from app.core.utils import new_id, ok, utcnow
from app.db import mongo
from app.schemas.profile import ProfileData

router = APIRouter(tags=["Career Profile"])


@router.get("/profile")
async def get_profile(user: CurrentUser = Depends(get_current_user)):
    data = await stored_profile(user.uid)
    return ok(ProfileData.model_validate(data).dump() if data is not None else None)


@router.put("/profile")
async def save_profile(payload: ProfileData, user: CurrentUser = Depends(get_current_user)):
    for section in (payload.experience, payload.education, payload.projects, payload.certifications, payload.links):
        for entry in section:
            entry.id = entry.id or new_id()
    data = payload.dump()
    now = utcnow()
    await mongo.profiles().update_one(
        {"_id": user.uid},
        {"$set": {"data": data, "updatedAt": now}, "$setOnInsert": {"createdAt": now}},
        upsert=True,
    )
    return ok(data, "Profile saved")
