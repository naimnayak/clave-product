"""Admin panel API (/api/admin). Access and permissions: services/admin.py. Every change is audited."""

import asyncio
import csv
import io
import logging
import re
from datetime import timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import Field

from app.core.config import get_settings
from app.core.errors import ApiError, not_found
from app.core.utils import iso, new_id, ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel
from app.services import accounts, admin, job_feed, plans
from app.services import resumes as resume_store
from app.services.admin import Staff, audit, get_staff, require
from app.services.apify_jobs import monthly_results_used
from app.services.notifications import notify

logger = logging.getLogger(__name__)
# The host check runs before authentication, so the admin API doesn't even reveal itself elsewhere.
router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(admin.require_admin_host)])


# ─── Helpers ────────────────────────────────────────────────────────────────────


def _page(page: int, limit: int) -> tuple[int, int]:
    return (page - 1) * limit, limit


def _search(q: str) -> dict[str, Any]:
    q = q.strip()
    if not q:
        return {}
    pattern = {"$regex": re.escape(q), "$options": "i"}
    return {"$or": [{"_id": q}, {"email": pattern}, {"name": pattern}]}


def _user_row(doc: dict[str, Any]) -> dict[str, Any]:
    sub = doc.get("subscription") or {}
    usage = doc.get("usage") or {}
    pro = plans.is_pro(sub)
    return {
        "id": doc["_id"],
        "name": doc.get("name") or "",
        "email": doc.get("email") or "",
        "avatarUrl": doc.get("avatarUrl") or None,
        "provider": doc.get("provider") or "password",
        "emailVerified": bool(doc.get("emailVerified")),
        "role": admin.role_of(doc),
        "owner": admin.is_owner(doc),
        "status": doc.get("status") or "active",
        "plan": plans.PRO_PLAN if pro else "free",
        "isPro": pro,
        "proExpired": sub.get("plan") == plans.PRO_PLAN and not pro,
        "currentPeriodEnd": iso(sub.get("currentPeriodEnd")),
        "compedByAdmin": bool(sub.get("grantedByAdmin")),
        "singleResumesBalance": int(sub.get("singleResumesBalance", 0)),
        "resumesCreated": int(usage.get("resumesCreated", 0)),
        "onboardingComplete": bool(doc.get("onboardingComplete")),
        "createdAt": iso(doc.get("createdAt")),
        "lastLoginAt": iso(doc.get("lastLoginAt")),
    }


async def _target(uid: str) -> dict[str, Any]:
    doc = await mongo.users().find_one({"_id": uid})
    if doc is None:
        raise not_found("User")
    return doc


def _guard_target(staff: Staff, doc: dict[str, Any], what: str) -> None:
    """Owners and your own account can't be changed from the panel, so nobody locks themselves out."""
    if admin.is_owner(doc):
        raise ApiError(409, "CONFLICT", f"Owners (ADMIN_EMAILS) can't be {what} from the panel.")
    if doc["_id"] == staff.uid:
        raise ApiError(409, "CONFLICT", f"You can't {what.split(' ')[0]} your own account here.")


def _payment_view(doc: dict[str, Any], email: str | None = None) -> dict[str, Any]:
    return {
        "id": doc["_id"],
        "uid": doc.get("uid"),
        "userEmail": email,
        "plan": doc.get("plan"),
        "amount": int(doc.get("amount", 0)) / 100,
        "currency": doc.get("currency", "INR"),
        "status": doc.get("status"),
        "paymentId": doc.get("paymentId"),
        "refundId": doc.get("refundId"),
        "refundedAmount": int(doc["refundedAmount"]) / 100 if doc.get("refundedAmount") else None,
        "createdAt": iso(doc.get("createdAt")),
        "paidAt": iso(doc.get("paidAt")),
        "refundedAt": iso(doc.get("refundedAt")),
    }


async def _emails(uids: set[str]) -> dict[str, str]:
    return {u["_id"]: u.get("email", "") async for u in mongo.users().find({"_id": {"$in": list(uids)}}, {"email": 1})} if uids else {}


# ─── Me & overview ──────────────────────────────────────────────────────────────


@router.get("/me")
async def admin_me(staff: Staff = Depends(get_staff)):
    return ok({"uid": staff.uid, "email": staff.email, "role": staff.role, "owner": staff.owner, "permissions": sorted(staff.permissions)})


async def _sum(collection, match: dict[str, Any], field: str) -> int:
    rows = await (await collection.aggregate([{"$match": match}, {"$group": {"_id": None, "total": {"$sum": f"${field}"}}}])).to_list()
    return int(rows[0]["total"]) if rows else 0


async def _daily(collection, match: dict[str, Any], date_field: str, value: Any, days: int) -> list[dict[str, Any]]:
    since = utcnow() - timedelta(days=days - 1)
    pipeline = [
        {"$match": {**match, date_field: {"$gte": since.replace(hour=0, minute=0, second=0, microsecond=0)}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": f"${date_field}"}}, "value": {"$sum": value}}},
    ]
    found = {row["_id"]: row["value"] async for row in await collection.aggregate(pipeline)}
    out = []
    for offset in range(days):
        day = (since + timedelta(days=offset)).strftime("%Y-%m-%d")
        out.append({"date": day, "value": found.get(day, 0)})
    return out


@router.get("/overview")
async def overview(staff: Staff = Depends(require("view"))):
    settings = get_settings()
    now = utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today = now.strftime("%Y-%m-%d")
    users, payments = mongo.users(), mongo.payments()
    pro_filter = {"subscription.plan": plans.PRO_PLAN, "subscription.currentPeriodEnd": {"$gt": now}}
    paid = {"status": "paid"}
    apify_used = await monthly_results_used()

    revenue_series = await _daily(payments, paid, "paidAt", {"$divide": ["$amount", 100]}, 30)
    return ok({
        "users": {
            "total": await users.count_documents({}),
            "new7d": await users.count_documents({"createdAt": {"$gte": now - timedelta(days=7)}}),
            "new30d": await users.count_documents({"createdAt": {"$gte": now - timedelta(days=30)}}),
            "active7d": await users.count_documents({"lastLoginAt": {"$gte": now - timedelta(days=7)}}),
            "suspended": await users.count_documents({"status": "suspended"}),
        },
        "subscriptions": {
            "pro": await users.count_documents(pro_filter),
            "proExpiring7d": await users.count_documents({**pro_filter, "subscription.currentPeriodEnd": {"$gt": now, "$lte": now + timedelta(days=7)}}),
            "comped": await users.count_documents({**pro_filter, "subscription.grantedByAdmin": True}),
            "withCredits": await users.count_documents({"subscription.singleResumesBalance": {"$gt": 0}}),
        },
        "revenue": {
            "currency": "INR",
            "thisMonth": await _sum(payments, {**paid, "paidAt": {"$gte": month_start}}, "amount") / 100,
            "allTime": await _sum(payments, paid, "amount") / 100,
            "paymentsThisMonth": await payments.count_documents({**paid, "paidAt": {"$gte": month_start}}),
            "refundedThisMonth": await _sum(payments, {"status": "refunded", "refundedAt": {"$gte": month_start}}, "refundedAmount") / 100,
        },
        "usage": {
            "resumesTotal": await mongo.resumes().count_documents({}),
            "resumes7d": await mongo.resumes().count_documents({"createdAt": {"$gte": now - timedelta(days=7)}}),
            "aiActionsToday": await _sum(mongo.ai_usage(), {"_id": {"$regex": f":{today}$"}}, "count"),
            "chatMessagesToday": await _sum(mongo.ai_usage(), {"_id": {"$regex": f":{today}$"}}, "chat"),
            "openChats": await mongo.chat_sessions().count_documents({"status": "active"}),
            "jobDescriptions": await mongo.job_descriptions().count_documents({}),
        },
        "jobs": {
            "active": await mongo.jobs().count_documents({"active": True}),
            "apifyResultsThisMonth": apify_used,
            "apifyMonthlyLimit": settings.apify_monthly_result_limit,
            "apifyEstimatedCostUsd": round(apify_used * settings.apify_cost_per_1000_usd / 1000, 2),
            "feedEnabled": job_feed.enabled(),
        },
        "support": {
            "openMessages": await mongo.contact_messages().count_documents({"status": {"$in": ["new", None]}}),
            "feedback7d": await mongo.feedback().count_documents({"createdAt": {"$gte": now - timedelta(days=7)}}),
        },
        "series": {
            "signups": await _daily(users, {}, "createdAt", 1, 30),
            "revenue": revenue_series,
        },
    })


# ─── Users ──────────────────────────────────────────────────────────────────────

UserSort = Literal["newest", "oldest", "lastLogin", "name", "proEnd"]
_SORTS: dict[str, list[tuple[str, int]]] = {
    "newest": [("createdAt", -1)],
    "oldest": [("createdAt", 1)],
    "lastLogin": [("lastLoginAt", -1)],
    "name": [("name", 1)],
    "proEnd": [("subscription.currentPeriodEnd", 1)],
}


def _user_filter(q: str, plan: str | None, status: str | None, role: str | None) -> dict[str, Any]:
    now = utcnow()
    query: dict[str, Any] = _search(q)
    if plan == "pro":
        query |= {"subscription.plan": plans.PRO_PLAN, "subscription.currentPeriodEnd": {"$gt": now}}
    elif plan == "expired":
        query |= {"subscription.plan": plans.PRO_PLAN, "subscription.currentPeriodEnd": {"$lte": now}}
    elif plan == "free":
        query |= {"$nor": [{"subscription.plan": plans.PRO_PLAN, "subscription.currentPeriodEnd": {"$gt": now}}]}
    elif plan == "credits":
        query |= {"subscription.singleResumesBalance": {"$gt": 0}}
    if status == "suspended":
        query["status"] = "suspended"
    elif status == "active":
        query["status"] = {"$ne": "suspended"}
    if role in {"admin", "support"}:
        query["role"] = role
    return query


@router.get("/users")
async def list_users(
    staff: Staff = Depends(require("view")),
    q: str = Query("", max_length=200),
    plan: Literal["pro", "free", "expired", "credits"] | None = None,
    status: Literal["active", "suspended"] | None = None,
    role: Literal["admin", "support"] | None = None,
    sort: UserSort = "newest",
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    query = _user_filter(q, plan, status, role)
    skip, take = _page(page, limit)
    cursor = mongo.users().find(query, {"settings": 0}).sort(_SORTS[sort]).skip(skip).limit(take)
    items = [_user_row(doc) async for doc in cursor]
    return ok({"items": items, "total": await mongo.users().count_documents(query), "page": page, "limit": limit})


@router.get("/users/export.csv")
async def export_users(
    staff: Staff = Depends(require("manage_users")),
    q: str = Query("", max_length=200),
    plan: Literal["pro", "free", "expired", "credits"] | None = None,
    status: Literal["active", "suspended"] | None = None,
):
    """Users matching the filters as CSV (personal data: admins only, and the export is audited)."""
    query = _user_filter(q, plan, status, None)
    columns = ["id", "name", "email", "plan", "currentPeriodEnd", "singleResumesBalance", "resumesCreated", "status", "role", "createdAt", "lastLoginAt"]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    count = 0
    async for doc in mongo.users().find(query, {"settings": 0}).sort("createdAt", -1).limit(50_000):
        row = _user_row(doc)
        # Neutralise spreadsheet formulas in user-controlled text.
        row["name"] = f"'{row['name']}" if row["name"][:1] in {"=", "+", "-", "@"} else row["name"]
        writer.writerow(row)
        count += 1
    await audit(staff, "users.export", None, {"count": count, "filters": {"q": q, "plan": plan, "status": status}})
    filename = f"clave-users-{utcnow().strftime('%Y-%m-%d')}.csv"
    return Response(buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/users/{uid}")
async def get_user(uid: str, staff: Staff = Depends(require("view"))):
    doc = await _target(uid)
    today = utcnow().strftime("%Y-%m-%d")
    ai_today = await mongo.ai_usage().find_one({"_id": f"{uid}:{today}"}) or {}
    resumes = [resume_store.summary(r) async for r in mongo.resumes().find({"uid": uid}, {"content": 0}).sort("updatedAt", -1).limit(20)]
    payments = [_payment_view(p, doc.get("email")) async for p in mongo.payments().find({"uid": uid}).sort("createdAt", -1).limit(50)]
    notes = [
        {"id": n["_id"], "text": n["text"], "authorEmail": n.get("authorEmail"), "createdAt": iso(n.get("createdAt"))}
        async for n in mongo.admin_notes().find({"uid": uid}).sort("createdAt", -1).limit(50)
    ]
    history = [
        {"id": a["_id"], "action": a["action"], "actorEmail": a.get("actorEmail"), "details": a.get("details") or {}, "at": iso(a.get("at"))}
        async for a in mongo.admin_audit().find({"target": uid}).sort("at", -1).limit(30)
    ]
    usage = doc.get("usage") or {}
    return ok({
        **_user_row(doc),
        "suspendedReason": doc.get("suspendedReason"),
        "suspendedAt": iso(doc.get("suspendedAt")),
        "usage": {**usage, "aiActionsToday": int(ai_today.get("count", 0)), "chatMessagesToday": int(ai_today.get("chat", 0))},
        "counts": {
            "resumes": await mongo.resumes().count_documents({"uid": uid}),
            "applications": await mongo.applications().count_documents({"uid": uid}),
            "savedJobs": await mongo.saved_jobs().count_documents({"uid": uid}),
            "jobDescriptions": await mongo.job_descriptions().count_documents({"uid": uid}),
            "mockInterviews": await mongo.interview_sessions().count_documents({"uid": uid}),
            "deviceClaims": await mongo.free_resume_claims().count_documents({"uid": uid}),
            "activeSessions": await mongo.sessions().count_documents({"uid": uid, "revoked": False}),
        },
        "jobFeed": await job_feed.status(uid) if plans.is_pro(doc.get("subscription")) else None,
        "resumes": resumes,
        "payments": payments,
        "notes": notes,
        "history": history,
    })


class SubscriptionChange(CamelModel):
    action: Literal["grant", "extend", "revoke"]
    days: int = Field(default=30, ge=1, le=3650)
    reason: str = Field(default="", max_length=500)


@router.post("/users/{uid}/subscription")
async def change_subscription(uid: str, payload: SubscriptionChange, staff: Staff = Depends(require("billing"))):
    """Comp, extend or end Clave Pro without a payment (payments stay untouched)."""
    doc = await _target(uid)
    sub = doc.get("subscription") or {}
    before = {"plan": sub.get("plan"), "currentPeriodEnd": iso(sub.get("currentPeriodEnd"))}
    now = utcnow()
    if payload.action == "revoke":
        update = {"subscription.plan": "free", "subscription.status": "active", "subscription.currentPeriodEnd": None, "subscription.grantedByAdmin": False}
    else:
        end = sub.get("currentPeriodEnd")
        start = max(end, now) if payload.action == "extend" and plans.is_pro(sub) and end else now
        update = {
            "subscription.plan": plans.PRO_PLAN,
            "subscription.status": "active",
            "subscription.currentPeriodEnd": start + timedelta(days=payload.days),
            "subscription.grantedByAdmin": True,
        }
    await mongo.users().update_one({"_id": uid}, {"$set": update})
    after = await _target(uid)
    await audit(staff, f"subscription.{payload.action}", uid, {"days": payload.days, "reason": payload.reason, "before": before, "after": {"plan": _user_row(after)["plan"], "currentPeriodEnd": _user_row(after)["currentPeriodEnd"]}})
    if payload.action != "revoke":
        await notify(uid, "account", "Clave Pro is active", "Your personal job feed, unlimited resumes and mock interviews are unlocked.", "/jobs")
        job_feed.refresh_in_background(uid, "upgrade")
    return ok(_user_row(after), "Subscription updated")


class CreditChange(CamelModel):
    delta: int = Field(ge=-100, le=100)
    reason: str = Field(default="", max_length=500)


@router.post("/users/{uid}/credits")
async def change_credits(uid: str, payload: CreditChange, staff: Staff = Depends(require("billing"))):
    """Adds or removes single-resume credits (never below zero)."""
    doc = await _target(uid)
    balance = int((doc.get("subscription") or {}).get("singleResumesBalance", 0))
    new_balance = max(0, balance + payload.delta)
    await mongo.users().update_one({"_id": uid}, {"$set": {"subscription.singleResumesBalance": new_balance}})
    await audit(staff, "credits.change", uid, {"before": balance, "after": new_balance, "reason": payload.reason})
    return ok(_user_row(await _target(uid)), "Credits updated")


class UsageReset(CamelModel):
    what: Literal["resumes", "mockInterviews", "aiToday", "deviceClaims"]
    reason: str = Field(default="", max_length=500)


@router.post("/users/{uid}/reset")
async def reset_usage(uid: str, payload: UsageReset, staff: Staff = Depends(require("manage_users"))):
    """Gives a user their free allowance back (e.g. after a support case)."""
    await _target(uid)
    if payload.what == "resumes":
        await mongo.users().update_one({"_id": uid}, {"$set": {"usage.resumesCreated": 0}})
    elif payload.what == "mockInterviews":
        await mongo.users().update_one({"_id": uid}, {"$set": {"usage.mockInterviews": 0}})
    elif payload.what == "aiToday":
        await mongo.ai_usage().delete_one({"_id": f"{uid}:{utcnow().strftime('%Y-%m-%d')}"})
    else:  # the device claims this user's resumes created, freeing those devices for new free resumes
        await mongo.free_resume_claims().delete_many({"uid": uid})
    await audit(staff, f"usage.reset.{payload.what}", uid, {"reason": payload.reason})
    return ok(_user_row(await _target(uid)), "Usage reset")


class StatusChange(CamelModel):
    status: Literal["active", "suspended"]
    reason: str = Field(default="", max_length=500)


@router.post("/users/{uid}/status")
async def change_status(uid: str, payload: StatusChange, staff: Staff = Depends(require("manage_users"))):
    doc = await _target(uid)
    _guard_target(staff, doc, "suspended")
    if payload.status == "suspended":
        await mongo.users().update_one({"_id": uid}, {"$set": {"status": "suspended", "suspendedAt": utcnow(), "suspendedReason": payload.reason}})
        await mongo.sessions().update_many({"uid": uid}, {"$set": {"revoked": True}})
        await asyncio.to_thread(admin.revoke_firebase_sessions, uid)
    else:
        await mongo.users().update_one({"_id": uid}, {"$set": {"status": "active"}, "$unset": {"suspendedAt": "", "suspendedReason": ""}})
    await audit(staff, f"user.{'suspend' if payload.status == 'suspended' else 'reactivate'}", uid, {"reason": payload.reason})
    return ok(_user_row(await _target(uid)), "Status updated")


class RoleChange(CamelModel):
    role: Literal["user", "support", "admin"]


@router.post("/users/{uid}/role")
async def change_role(uid: str, payload: RoleChange, staff: Staff = Depends(require("roles"))):
    doc = await _target(uid)
    _guard_target(staff, doc, "given a different role")
    if payload.role != "user" and not doc.get("emailVerified"):
        raise ApiError(409, "CONFLICT", "Staff accounts need a verified email.")
    before = admin.role_of(doc)
    await mongo.users().update_one({"_id": uid}, {"$set": {"role": payload.role}})
    await audit(staff, "user.role", uid, {"before": before, "after": payload.role})
    return ok(_user_row(await _target(uid)), "Role updated")


class NoteIn(CamelModel):
    text: str = Field(min_length=1, max_length=4000)


@router.post("/users/{uid}/notes", status_code=201)
async def add_note(uid: str, payload: NoteIn, staff: Staff = Depends(require("notes"))):
    await _target(uid)
    note = {"_id": new_id("note_"), "uid": uid, "text": payload.text.strip(), "authorUid": staff.uid, "authorEmail": staff.email, "createdAt": utcnow()}
    await mongo.admin_notes().insert_one(note)
    await audit(staff, "note.add", uid)
    return ok({"id": note["_id"], "text": note["text"], "authorEmail": staff.email, "createdAt": iso(note["createdAt"])})


@router.delete("/users/{uid}/notes/{note_id}", status_code=204)
async def delete_note(uid: str, note_id: str, staff: Staff = Depends(require("notes"))):
    note = await mongo.admin_notes().find_one({"_id": note_id, "uid": uid})
    if note is None:
        raise not_found("Note")
    if note.get("authorUid") != staff.uid and not staff.can("manage_users"):
        raise ApiError(403, "FORBIDDEN", "Only the author or an admin can delete this note.")
    await mongo.admin_notes().delete_one({"_id": note_id})
    await audit(staff, "note.delete", uid)
    return Response(status_code=204)


class MessageIn(CamelModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(default="", max_length=1000)
    link: str | None = Field(default=None, max_length=300, pattern=r"^/[A-Za-z0-9/_\-?=&.]*$")


@router.post("/users/{uid}/notify")
async def notify_user(uid: str, payload: MessageIn, staff: Staff = Depends(require("manage_users"))):
    await _target(uid)
    await notify(uid, "account", payload.title.strip(), payload.body.strip(), payload.link)
    await audit(staff, "user.notify", uid, {"title": payload.title})
    return ok(None, "Notification sent")


@router.post("/users/{uid}/refresh-feed")
async def refresh_user_feed(uid: str, staff: Staff = Depends(require("manage_users"))):
    """Runs one job-feed search for a Pro user now (counts against their monthly searches)."""
    await _target(uid)
    summary = await job_feed.refresh(uid, "upgrade")
    await audit(staff, "jobs.refresh_feed", uid, {k: summary.get(k) for k in ("query", "created", "errors")})
    return ok({k: v for k, v in summary.items() if k != "uid"})


class DeleteUser(CamelModel):
    confirm_email: str = Field(min_length=3, max_length=320)
    reason: str = Field(default="", max_length=500)


@router.post("/users/{uid}/delete")
async def delete_user(uid: str, payload: DeleteUser, staff: Staff = Depends(require("delete_users"))):
    """Permanently deletes the account and its data (payments are kept). Needs the user's email typed back."""
    doc = await _target(uid)
    _guard_target(staff, doc, "deleted")
    if payload.confirm_email.strip().lower() != (doc.get("email") or "").lower():
        raise ApiError(422, "VALIDATION_ERROR", "Type the user's email exactly to confirm.", [{"field": "confirmEmail", "message": "Doesn't match"}])
    await accounts.delete_account(uid)
    await audit(staff, "user.delete", uid, {"email": doc.get("email"), "reason": payload.reason})
    return ok(None, "User deleted")


# ─── Plans & pricing ────────────────────────────────────────────────────────────


class PlanLimitsIn(CamelModel):
    resumes: int | None = Field(default=None, ge=0, le=100_000)
    ai_daily: int | None = Field(default=None, ge=0, le=100_000)
    chat_daily: int | None = Field(default=None, ge=0, le=100_000)
    mock_interviews: int | None = Field(default=None, ge=0, le=100_000)


class PlanFeaturesIn(CamelModel):
    jobs: bool = False
    job_preview: bool = True
    chat_memory: bool = True


class PlanUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=200)
    price: int | None = Field(default=None, ge=0, le=100_000)
    period_days: int | None = Field(default=None, ge=1, le=366)
    active: bool | None = None
    limits: PlanLimitsIn | None = None
    features: PlanFeaturesIn | None = None


@router.get("/plans")
async def admin_plans(staff: Staff = Depends(require("view"))):
    catalog = await plans.all_plans()
    ordered = sorted(catalog.values(), key=lambda p: p.get("sortOrder", 0))
    return ok([{**plans.public_view(p), "active": p.get("active", True), "updatedAt": iso(p.get("updatedAt"))} for p in ordered])


@router.put("/plans/{plan_id}")
async def update_plan(plan_id: Literal["free", "single", "monthly"], payload: PlanUpdate, staff: Staff = Depends(require("plans"))):
    """Edits a plan. Prices apply to new orders immediately; limits apply to everyone on the plan."""
    before = await plans.get_plan(plan_id)
    changes: dict[str, Any] = {}
    fields = payload.model_fields_set
    if "name" in fields and payload.name:
        changes["name"] = payload.name.strip()
    if "description" in fields and payload.description is not None:
        changes["description"] = payload.description.strip()
    if "price" in fields and payload.price is not None:
        if plan_id == "free" and payload.price != 0:
            raise ApiError(422, "VALIDATION_ERROR", "The Free plan's price must stay 0.", [{"field": "price", "message": "Must be 0"}])
        if plan_id != "free" and payload.price < 1:
            raise ApiError(422, "VALIDATION_ERROR", "Paid plans need a price of at least ₹1.", [{"field": "price", "message": "At least 1"}])
        changes["price"] = payload.price
    if "period_days" in fields and payload.period_days is not None:
        if plan_id != plans.PRO_PLAN:
            raise ApiError(422, "VALIDATION_ERROR", "Only Clave Pro has a period.", [{"field": "periodDays", "message": "Not allowed"}])
        changes["periodDays"] = payload.period_days
    if "active" in fields and payload.active is not None:
        if plan_id == "free" and not payload.active:
            raise ApiError(422, "VALIDATION_ERROR", "The Free plan can't be switched off.", [{"field": "active", "message": "Must stay on"}])
        changes["active"] = payload.active
    if payload.limits is not None and plan_id != "single":
        changes["limits"] = payload.limits.model_dump(by_alias=True)
    if payload.features is not None and plan_id != "single":
        changes["features"] = payload.features.model_dump(by_alias=True)
    if not changes:
        return ok(plans.public_view(before), "Nothing to change")
    changes["updatedAt"] = utcnow()
    await mongo.plans().update_one({"_id": plan_id}, {"$set": changes})
    after = await plans.get_plan(plan_id)
    keys = [k for k in changes if k != "updatedAt"]
    await audit(staff, "plan.update", plan_id, {"before": {k: before.get(k) for k in keys}, "after": {k: after.get(k) for k in keys}})
    return ok({**plans.public_view(after), "active": after.get("active", True), "updatedAt": iso(after.get("updatedAt"))}, "Plan updated")


# ─── Payments ───────────────────────────────────────────────────────────────────


@router.get("/payments")
async def list_payments(
    staff: Staff = Depends(require("view")),
    status: Literal["created", "paid", "refunded"] | None = None,
    plan: Literal["single", "monthly"] | None = None,
    q: str = Query("", max_length=200),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if plan:
        query["plan"] = plan
    if q.strip():
        uids = [u["_id"] async for u in mongo.users().find(_search(q), {"_id": 1}).limit(200)]
        query["$or"] = [{"_id": q.strip()}, {"paymentId": q.strip()}, {"uid": {"$in": uids}}]
    skip, take = _page(page, limit)
    docs = [d async for d in mongo.payments().find(query).sort("createdAt", -1).skip(skip).limit(take)]
    emails = await _emails({d["uid"] for d in docs if d.get("uid")})
    return ok({"items": [_payment_view(d, emails.get(d.get("uid"))) for d in docs], "total": await mongo.payments().count_documents(query), "page": page, "limit": limit})


class RefundIn(CamelModel):
    amount: float | None = Field(default=None, gt=0)  # rupees; empty = full refund
    revoke_plan: bool = True
    reason: str = Field(default="", max_length=500)


def _razorpay_refund(payment_id: str, amount_paise: int) -> dict[str, Any]:
    """Issues the refund at Razorpay (blocking; call in a thread)."""
    from app.api.billing import _razorpay

    return _razorpay().payment.refund(payment_id, {"amount": amount_paise, "speed": "normal"})


@router.post("/payments/{order_id}/refund")
async def refund_payment(order_id: str, payload: RefundIn, staff: Staff = Depends(require("billing"))):
    """Refunds a paid order through Razorpay and, by default, takes back what it granted."""
    order = await mongo.payments().find_one({"_id": order_id})
    if order is None:
        raise not_found("Payment")
    if order.get("status") != "paid" or not order.get("paymentId"):
        raise ApiError(409, "CONFLICT", "Only paid orders can be refunded.")
    amount = int(round(payload.amount * 100)) if payload.amount else int(order["amount"])
    if amount > int(order["amount"]):
        raise ApiError(422, "VALIDATION_ERROR", "The refund can't be more than the payment.", [{"field": "amount", "message": "Too high"}])
    # Claim the order first so two clicks can't refund twice.
    claimed = await mongo.payments().find_one_and_update({"_id": order_id, "status": "paid"}, {"$set": {"status": "refunding"}})
    if claimed is None:
        raise ApiError(409, "CONFLICT", "This payment is already being refunded.")
    try:
        refund = await asyncio.to_thread(_razorpay_refund, order["paymentId"], amount)
    except ApiError:
        await mongo.payments().update_one({"_id": order_id}, {"$set": {"status": "paid"}})
        raise
    except Exception as exc:  # gateway errors
        await mongo.payments().update_one({"_id": order_id}, {"$set": {"status": "paid"}})
        logger.error("Razorpay refund failed for %s: %s", order_id, exc)
        raise ApiError(502, "PAYMENT_GATEWAY_ERROR", f"Razorpay refused the refund: {exc}") from exc

    await mongo.payments().update_one(
        {"_id": order_id},
        {"$set": {"status": "refunded", "refundId": refund.get("id"), "refundedAmount": amount, "refundedAt": utcnow(), "refundReason": payload.reason}},
    )
    if payload.revoke_plan:
        uid = order["uid"]
        if order["plan"] == "single":
            await mongo.users().update_one({"_id": uid, "subscription.singleResumesBalance": {"$gt": 0}}, {"$inc": {"subscription.singleResumesBalance": -1}})
        else:
            plan = await plans.get_plan(plans.PRO_PLAN)
            doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1}) or {}
            end = (doc.get("subscription") or {}).get("currentPeriodEnd")
            if end:
                new_end = end - timedelta(days=int(plan.get("periodDays") or get_settings().monthly_plan_days))
                update = {"subscription.currentPeriodEnd": new_end} if new_end > utcnow() else {"subscription.plan": "free", "subscription.currentPeriodEnd": None}
                await mongo.users().update_one({"_id": uid}, {"$set": update})
    await audit(staff, "payment.refund", order.get("uid"), {"orderId": order_id, "amount": amount / 100, "revokePlan": payload.revoke_plan, "reason": payload.reason})
    updated = await mongo.payments().find_one({"_id": order_id})
    return ok(_payment_view(updated, (await _emails({order["uid"]})).get(order["uid"])), "Refund issued")


# ─── Jobs & job feed ────────────────────────────────────────────────────────────


@router.get("/jobs/stats")
async def job_stats(staff: Staff = Depends(require("view"))):
    settings = get_settings()
    by_source = {row["_id"] or "unknown": row["n"] async for row in await mongo.jobs().aggregate([
        {"$match": {"active": True}}, {"$group": {"_id": "$source", "n": {"$sum": 1}}}, {"$sort": {"n": -1}},
    ])}
    month = utcnow().strftime("%Y-%m")
    feed_users = await mongo.job_feed_usage().count_documents({"_id": {"$regex": f"^user:.*:{month}$"}})
    used = await monthly_results_used()
    recent = [
        {"startedAt": iso(r.get("startedAt")), "created": r.get("created", 0), "fetched": r.get("fetched", 0), "errors": (r.get("errors") or [])[:5]}
        async for r in mongo.ingest_runs().find({"_id": {"$ne": "lease"}}).sort("startedAt", -1).limit(5)
    ]
    latest = [
        {"id": j["_id"], "title": j.get("title", ""), "company": j.get("company", ""), "source": j.get("source", ""), "active": j.get("active", False), "postedAt": iso(j.get("postedAt"))}
        async for j in mongo.jobs().find({}, {"title": 1, "company": 1, "source": 1, "active": 1, "postedAt": 1}).sort("ingestedAt", -1).limit(25)
    ]
    return ok({
        "active": sum(by_source.values()),
        "bySource": by_source,
        "feedEnabled": job_feed.enabled(),
        "linkedinEnabled": settings.apify_linkedin_enabled,
        "sources": [s.strip() for s in settings.job_feed_sources.split(",") if s.strip()],
        "apify": {"resultsThisMonth": used, "monthlyLimit": settings.apify_monthly_result_limit, "estimatedCostUsd": round(used * settings.apify_cost_per_1000_usd / 1000, 2)},
        "feedUsersThisMonth": feed_users,
        "caps": {
            "resultsPerSearch": settings.job_feed_results_per_search,
            "refreshDays": settings.job_feed_refresh_days,
            "scheduledPerMonth": settings.job_feed_scheduled_per_month,
            "jdSearchesPerMonth": settings.job_feed_jd_searches_per_month,
        },
        "recentIngestRuns": recent,
        "latestJobs": latest,
    })


class JobActive(CamelModel):
    active: bool


@router.post("/jobs/{job_id}/active")
async def set_job_active(job_id: str, payload: JobActive, staff: Staff = Depends(require("manage_users"))):
    """Hides a bad or spam listing from every feed (or brings it back)."""
    result = await mongo.jobs().update_one({"_id": job_id}, {"$set": {"active": payload.active, "hiddenByAdmin": not payload.active}})
    if not result.matched_count:
        raise not_found("Job")
    await audit(staff, "job.show" if payload.active else "job.hide", job_id)
    return ok({"id": job_id, "active": payload.active})


# ─── Support inbox ──────────────────────────────────────────────────────────────


@router.get("/support/messages")
async def support_messages(
    staff: Staff = Depends(require("support")),
    status: Literal["new", "resolved", "all"] = "new",
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    query: dict[str, Any] = {} if status == "all" else {"status": {"$in": ["new", None]}} if status == "new" else {"status": "resolved"}
    skip, take = _page(page, limit)
    items = [
        {
            "id": m["_id"], "name": m.get("name", ""), "email": m.get("email", ""), "topic": m.get("topic", ""), "message": m.get("message", ""),
            "status": m.get("status") or "new", "createdAt": iso(m.get("createdAt")), "resolvedAt": iso(m.get("resolvedAt")), "resolvedBy": m.get("resolvedBy"),
        }
        async for m in mongo.contact_messages().find(query).sort("createdAt", -1).skip(skip).limit(take)
    ]
    return ok({"items": items, "total": await mongo.contact_messages().count_documents(query), "page": page, "limit": limit})


class MessageStatus(CamelModel):
    status: Literal["new", "resolved"]


@router.post("/support/messages/{message_id}/status")
async def set_message_status(message_id: str, payload: MessageStatus, staff: Staff = Depends(require("support"))):
    update = {"$set": {"status": "resolved", "resolvedAt": utcnow(), "resolvedBy": staff.email}} if payload.status == "resolved" else {
        "$set": {"status": "new"}, "$unset": {"resolvedAt": "", "resolvedBy": ""}}
    result = await mongo.contact_messages().update_one({"_id": message_id}, update)
    if not result.matched_count:
        raise not_found("Message")
    await audit(staff, f"support.{payload.status}", message_id)
    return ok({"id": message_id, "status": payload.status})


@router.get("/support/feedback")
async def support_feedback(staff: Staff = Depends(require("support")), page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100)):
    skip, take = _page(page, limit)
    items = [
        {"id": f["_id"], "uid": f.get("uid"), "email": f.get("email", ""), "message": f.get("message", ""), "page": f.get("page", ""), "rating": f.get("rating"), "createdAt": iso(f.get("createdAt"))}
        async for f in mongo.feedback().find({}).sort("createdAt", -1).skip(skip).limit(take)
    ]
    return ok({"items": items, "total": await mongo.feedback().count_documents({}), "page": page, "limit": limit})


# ─── Broadcast ──────────────────────────────────────────────────────────────────


class BroadcastIn(MessageIn):
    audience: Literal["all", "pro", "free"] = "all"


@router.post("/broadcast")
async def broadcast(payload: BroadcastIn, staff: Staff = Depends(require("broadcast"))):
    """In-app announcement to a segment. Respects each user's 'Product updates' notification setting; no email."""
    now = utcnow()
    pro = {"subscription.plan": plans.PRO_PLAN, "subscription.currentPeriodEnd": {"$gt": now}}
    query: dict[str, Any] = {"status": {"$ne": "suspended"}, "settings.notifications.product": {"$ne": False}}
    if payload.audience == "pro":
        query |= pro
    elif payload.audience == "free":
        query["$nor"] = [pro]
    expire = now + timedelta(days=get_settings().notification_retention_days)
    batch: list[dict[str, Any]] = []
    sent = 0
    async for user in mongo.users().find(query, {"_id": 1}):
        batch.append({"_id": new_id("ntf_"), "uid": user["_id"], "category": "product", "title": payload.title.strip(), "body": payload.body.strip(),
                      "link": payload.link, "read": False, "createdAt": now, "expireAt": expire})
        if len(batch) >= 500:
            await mongo.notifications().insert_many(batch)
            sent += len(batch)
            batch = []
    if batch:
        await mongo.notifications().insert_many(batch)
        sent += len(batch)
    await audit(staff, "broadcast", payload.audience, {"title": payload.title, "sent": sent})
    return ok({"sent": sent}, f"Sent to {sent} users")


# ─── Audit log ──────────────────────────────────────────────────────────────────


@router.get("/audit")
async def audit_log(
    staff: Staff = Depends(require("view")),
    action: str = Query("", max_length=60),
    target: str = Query("", max_length=120),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    query: dict[str, Any] = {}
    if action.strip():
        query["action"] = {"$regex": f"^{re.escape(action.strip())}"}
    if target.strip():
        query["target"] = target.strip()
    skip, take = _page(page, limit)
    items = [
        {"id": a["_id"], "at": iso(a.get("at")), "actorEmail": a.get("actorEmail"), "actorRole": a.get("actorRole"), "action": a["action"],
         "target": a.get("target"), "details": a.get("details") or {}, "ip": a.get("ip")}
        async for a in mongo.admin_audit().find(query).sort("at", -1).skip(skip).limit(take)
    ]
    return ok({"items": items, "total": await mongo.admin_audit().count_documents(query), "page": page, "limit": limit})
