"""Free-resume device guard.

Free resumes are capped per account (the plan limit) and also per device, so creating new accounts on
the same browser doesn't reset the allowance. The device is the random browser id the frontend sends
in `X-Clave-Device`. Claims are counted per device and per device + IP pair, never per IP alone, so
other devices on the same campus or home network are not locked out. Requests without a device id
(API clients) fall back to a user-agent hash paired with the IP.

Only salted SHA-256 hashes are stored. Clearing browser storage produces a new device id; the
per-account limit still applies in that case.
"""

import hashlib
import logging
import re
from dataclasses import dataclass

from fastapi import Request

from app.core.config import get_settings
from app.core.utils import utcnow
from app.db import mongo

logger = logging.getLogger(__name__)
DEVICE_HEADER = "x-clave-device"
_DEVICE_ID = re.compile(r"^[A-Za-z0-9-]{16,64}$")


@dataclass
class GuardDecision:
    blocked: bool
    reason: str | None = None
    pair_hash: str | None = None
    device_hash: str | None = None


def _sha256(value: str) -> str:
    salt = get_settings().free_resume_guard_hash_salt
    return hashlib.sha256(f"{salt}{value}".encode()).hexdigest()


def client_ip(request: Request) -> str | None:
    """The peer address as resolved by uvicorn's proxy-headers handling.

    Raw X-Forwarded-For is deliberately not parsed here: clients can prepend fake entries. The edge
    nginx overwrites the header with the real peer address (deploy/nginx/atelierdevs.tech.conf).
    """
    return request.client.host if request.client else None


def device_id(request: Request) -> str | None:
    value = (request.headers.get(DEVICE_HEADER) or "").strip()
    return value if _DEVICE_ID.match(value) else None


def _keys(request: Request) -> tuple[str | None, str | None]:
    ip = client_ip(request) or "unknown"
    device = device_id(request)
    if device:
        return _sha256(f"pair|{ip}|{device}"), _sha256(f"device|{device}")
    agent = request.headers.get("user-agent", "").strip()
    return _sha256(f"pair|{ip}|ua:{agent}"), None


async def evaluate(request: Request, uid: str) -> GuardDecision:
    """Blocks once this device, or this device on this network, has used up the free allowance."""
    cap = get_settings().free_resumes_per_device
    pair_hash, device_hash = _keys(request)
    claims = mongo.free_resume_claims()
    if device_hash and await claims.count_documents({"deviceHash": device_hash}, limit=cap) >= cap:
        return GuardDecision(True, "device_limit_reached", pair_hash, device_hash)
    if pair_hash and await claims.count_documents({"pairHash": pair_hash}, limit=cap) >= cap:
        return GuardDecision(True, "device_network_limit_reached", pair_hash, device_hash)
    return GuardDecision(False, None, pair_hash, device_hash)


async def record(uid: str, decision: GuardDecision) -> None:
    await mongo.free_resume_claims().insert_one(
        {"uid": uid, "pairHash": decision.pair_hash, "deviceHash": decision.device_hash, "claimedAt": utcnow()}
    )


def warn_if_unsalted() -> None:
    settings = get_settings()
    if settings.free_resume_guard_enabled and not settings.free_resume_guard_hash_salt:
        logger.warning("FREE_RESUME_GUARD_HASH_SALT is empty; set a random value so device and IP hashes can't be reversed.")
