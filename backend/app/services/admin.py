"""Admin panel: roles, permissions and the audit log.

Roles (stored in `users.role`):
- `admin`: everything, including pricing, subscriptions, refunds, roles, suspensions and deletions.
- `support`: read-only access to users, payments and metrics, plus the support inbox and user notes.

Owners are the verified emails in ADMIN_EMAILS. They are always admins and can't be demoted, suspended
or deleted from the panel, so the panel can never lock its owners out. Every change made through the
panel is written to `admin_audit`.
"""

import logging
from dataclasses import dataclass
from typing import Any, Literal

from fastapi import Depends, Request
from firebase_admin import auth as firebase_auth

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import CurrentUser, get_current_user
from app.core.utils import new_id, utcnow
from app.db import mongo

logger = logging.getLogger(__name__)

Role = Literal["user", "support", "admin"]
Permission = Literal["view", "support", "notes", "manage_users", "billing", "plans", "roles", "broadcast", "delete_users"]

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {"view", "support", "notes", "manage_users", "billing", "plans", "roles", "broadcast", "delete_users"},
    "support": {"view", "support", "notes"},
    "user": set(),
}


def is_owner(doc: dict[str, Any] | None) -> bool:
    doc = doc or {}
    return bool(doc.get("emailVerified")) and (doc.get("email") or "").lower() in get_settings().admin_email_set


def role_of(doc: dict[str, Any] | None) -> Role:
    if is_owner(doc):
        return "admin"
    role = (doc or {}).get("role")
    return role if role in ROLE_PERMISSIONS else "user"


def permissions_of(doc: dict[str, Any] | None) -> set[str]:
    return ROLE_PERMISSIONS[role_of(doc)]


@dataclass(frozen=True)
class Staff:
    uid: str
    email: str
    role: Role
    owner: bool
    permissions: frozenset[str]
    ip: str | None

    def can(self, permission: str) -> bool:
        return permission in self.permissions


def require_admin_host(request: Request) -> None:
    """With ADMIN_HOST set, the admin API only exists on the admin subdomain (404 everywhere else)."""
    expected = get_settings().admin_host.strip().lower()
    if not expected:
        return
    host = (request.headers.get("host") or "").split(":")[0].strip().lower()
    if host != expected:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Not found.")


async def get_staff(request: Request, user: CurrentUser = Depends(get_current_user)) -> Staff:
    """Any admin-panel request. Rejects everyone who isn't admin or support staff."""
    doc = await mongo.users().find_one({"_id": user.uid}, {"email": 1, "emailVerified": 1, "role": 1})
    # The owner check needs the live token's verification too, not just the stored flag.
    owner = user.email_verified and user.email in get_settings().admin_email_set
    role: Role = "admin" if owner else role_of(doc)
    if role == "user":
        raise ApiError(403, "FORBIDDEN", "You don't have access to the admin panel.")
    return Staff(user.uid, user.email, role, owner, frozenset(ROLE_PERMISSIONS[role]), request.client.host if request.client else None)


def require(permission: Permission):
    """Dependency factory: the staff member must hold `permission`."""

    async def dependency(staff: Staff = Depends(get_staff)) -> Staff:
        if not staff.can(permission):
            raise ApiError(403, "FORBIDDEN", "Your admin role doesn't allow this action.")
        return staff

    return dependency


async def audit(staff: Staff, action: str, target: str | None = None, details: dict[str, Any] | None = None) -> None:
    await mongo.admin_audit().insert_one({
        "_id": new_id("aud_"),
        "at": utcnow(),
        "actorUid": staff.uid,
        "actorEmail": staff.email,
        "actorRole": staff.role,
        "action": action,
        "target": target,
        "details": details or {},
        "ip": staff.ip,
    })


def revoke_firebase_sessions(uid: str) -> None:
    """Signs a suspended user out everywhere (blocking; call in a thread). Best effort."""
    try:
        firebase_auth.revoke_refresh_tokens(uid)
    except Exception as exc:  # user already deleted, network errors
        logger.warning("Could not revoke Firebase sessions for %s: %s", uid, exc)
