"""In-app notifications for the navbar bell."""

from fastapi import APIRouter, Depends, Query
from pydantic import Field

from app.core.security import CurrentUser, get_current_user
from app.core.utils import ok
from app.db import mongo
from app.schemas.common import CamelModel
from app.services.notifications import view

router = APIRouter(tags=["Notifications"])


class MarkRead(CamelModel):
    # Empty list = mark everything as read.
    ids: list[str] = Field(default_factory=list, max_length=100)


@router.get("/notifications")
async def list_notifications(user: CurrentUser = Depends(get_current_user), limit: int = Query(30, ge=1, le=100)):
    cursor = mongo.notifications().find({"uid": user.uid}).sort("createdAt", -1).limit(limit)
    items = [view(doc) async for doc in cursor]
    unread = await mongo.notifications().count_documents({"uid": user.uid, "read": False})
    return ok({"items": items, "unreadCount": unread})


@router.post("/notifications/read")
async def mark_read(payload: MarkRead, user: CurrentUser = Depends(get_current_user)):
    query: dict = {"uid": user.uid, "read": False}
    if payload.ids:
        query["_id"] = {"$in": payload.ids}
    await mongo.notifications().update_many(query, {"$set": {"read": True}})
    unread = await mongo.notifications().count_documents({"uid": user.uid, "read": False})
    return ok({"unreadCount": unread})
