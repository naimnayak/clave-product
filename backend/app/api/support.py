"""Contact form (public) and in-app feedback. Messages are stored and, when SMTP is set up, emailed to support."""

from fastapi import APIRouter, Depends, Request
from pydantic import EmailStr, Field

from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.security import CurrentUser, get_current_user
from app.core.utils import new_id, ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel, ShortText
from app.services import email

router = APIRouter(tags=["Support"])


class ContactRequest(CamelModel):
    name: ShortText = Field(min_length=1)
    email: EmailStr
    topic: ShortText = "General question"
    message: str = Field(min_length=10, max_length=5000)
    # Honeypot: real people never see or fill this field.
    website: str = ""


class FeedbackRequest(CamelModel):
    message: str = Field(min_length=3, max_length=5000)
    page: ShortText = ""
    rating: int | None = Field(default=None, ge=1, le=5)


@router.post("/contact", status_code=201)
@limiter.limit("5/hour")
async def contact(request: Request, payload: ContactRequest):
    if payload.website:  # bot: pretend success, store nothing
        return ok({"received": True}, "Thanks, we'll get back to you soon.")
    doc = {
        "_id": new_id("msg_"),
        "name": payload.name.strip(),
        "email": str(payload.email).lower(),
        "topic": payload.topic.strip(),
        "message": payload.message.strip(),
        "createdAt": utcnow(),
        "status": "new",
    }
    await mongo.contact_messages().insert_one(doc)
    emailed = await email.send(
        get_settings().support_inbox,
        f"[Contact] {doc['topic']} from {doc['name']}",
        f"From: {doc['name']} <{doc['email']}>\nTopic: {doc['topic']}\n\n{doc['message']}",
        reply_to=doc["email"],
    )
    await mongo.contact_messages().update_one({"_id": doc["_id"]}, {"$set": {"emailed": emailed}})
    return ok({"received": True}, "Thanks, we'll get back to you soon.")


@router.post("/feedback", status_code=201)
@limiter.limit("20/hour")
async def feedback(request: Request, payload: FeedbackRequest, user: CurrentUser = Depends(get_current_user)):
    doc = {
        "_id": new_id("fb_"),
        "uid": user.uid,
        "email": user.email,
        "message": payload.message.strip(),
        "page": payload.page,
        "rating": payload.rating,
        "createdAt": utcnow(),
    }
    await mongo.feedback().insert_one(doc)
    await email.send(get_settings().support_inbox, "[Feedback] from a Clave user", f"From: {user.email}\nPage: {payload.page}\n\n{doc['message']}", reply_to=user.email)
    return ok({"received": True}, "Thanks for the feedback.")
