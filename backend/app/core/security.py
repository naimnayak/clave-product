"""Firebase Authentication: the frontend signs users in with Firebase and sends the ID token as a Bearer token."""

import asyncio
import logging
import time
from dataclasses import dataclass

import firebase_admin
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.core.config import get_settings
from app.core.errors import ApiError

logger = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


def init_firebase() -> None:
    if firebase_admin._apps:
        return
    settings = get_settings()
    path = settings.resolve_path(settings.firebase_service_account)
    if not path.exists():
        raise RuntimeError(
            f"Firebase service account file not found at {path}. Set FIREBASE_SERVICE_ACCOUNT in backend/.env."
        )
    firebase_admin.initialize_app(credentials.Certificate(str(path)))


@dataclass(frozen=True)
class CurrentUser:
    uid: str
    email: str
    name: str
    picture: str | None
    email_verified: bool
    provider: str


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise ApiError(401, "UNAUTHENTICATED", "Sign in to continue.")
    try:
        decoded = await asyncio.to_thread(firebase_auth.verify_id_token, creds.credentials, clock_skew_seconds=10)
    except firebase_auth.ExpiredIdTokenError as exc:
        raise ApiError(401, "TOKEN_EXPIRED", "Your session has expired. Please sign in again.") from exc
    except firebase_auth.CertificateFetchError as exc:
        logger.warning("Could not fetch Firebase public keys: %s", exc)
        raise ApiError(503, "SERVICE_UNAVAILABLE", "Sign-in service is temporarily unavailable.") from exc
    except (firebase_auth.InvalidIdTokenError, ValueError) as exc:
        raise ApiError(401, "UNAUTHENTICATED", "Your session is invalid. Please sign in again.") from exc

    user = CurrentUser(
        uid=decoded["uid"],
        email=(decoded.get("email") or "").lower(),
        name=decoded.get("name") or "",
        picture=decoded.get("picture"),
        email_verified=bool(decoded.get("email_verified")),
        provider=(decoded.get("firebase") or {}).get("sign_in_provider", "password"),
    )
    # Used by the rate limiter so limits apply per account rather than per IP.
    request.state.uid = user.uid
    from app.db import mongo  # local imports: these depend on the database layer
    from app.services import sessions

    account = await mongo.users().find_one({"_id": user.uid}, {"status": 1})
    if account and account.get("status") == "suspended":
        raise ApiError(401, "ACCOUNT_SUSPENDED", "This account has been suspended. Contact support if you think this is a mistake.")

    request.state.session_id = await sessions.check_and_touch(user.uid, request)
    return user


def delete_firebase_user(uid: str, attempts: int = 3) -> bool:
    """Deletes the Firebase login. Retries transient network errors; returns False if it still failed."""
    for attempt in range(1, attempts + 1):
        try:
            firebase_auth.delete_user(uid)
            return True
        except firebase_auth.UserNotFoundError:
            return True
        except Exception as exc:  # transport errors surface as several google-auth / requests types
            logger.warning("Deleting Firebase user %s failed (attempt %d/%d): %s", uid, attempt, attempts, exc)
            if attempt < attempts:
                time.sleep(attempt)
    logger.error("Firebase user %s could not be deleted; remove it from the Firebase console.", uid)
    return False


def firebase_login_info(uid: str) -> dict:
    """Sign-in methods and password age from Firebase (blocking; call in a thread)."""
    try:
        record = firebase_auth.get_user(uid)
    except firebase_auth.UserNotFoundError:
        return {"providers": [], "passwordUpdatedAt": None}
    providers = sorted({info.provider_id for info in record.provider_data})
    raw = getattr(record, "_data", {}) or {}
    updated_ms = raw.get("passwordUpdatedAt")
    return {"providers": providers, "passwordUpdatedAt": int(updated_ms) if updated_ms else None}
