"""Free-resume abuse guard ported from the ATS backend: one free resume per network/device.

Only hashes are stored. Disabled unless FREE_RESUME_GUARD_ENABLED=true, because students on the
same campus network share IP addresses.
"""

import hashlib
from dataclasses import dataclass

from fastapi import Request

from app.core.config import get_settings
from app.core.utils import utcnow
from app.db import mongo


@dataclass
class GuardDecision:
    blocked: bool
    reason: str | None = None
    ip_hash: str | None = None
    fingerprint_hash: str | None = None


def _sha256(value: str) -> str:
    salt = get_settings().free_resume_guard_hash_salt
    return hashlib.sha256(f"{salt}{value}".encode()).hexdigest()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if real_ip := request.headers.get("x-real-ip"):
        return real_ip.strip()
    return request.client.host if request.client else None


def _fingerprint(request: Request) -> str | None:
    raw = "|".join(request.headers.get(h, "").strip() for h in ("user-agent", "accept-language", "sec-ch-ua"))
    return _sha256(raw) if raw.replace("|", "") else None


async def evaluate(request: Request, uid: str) -> GuardDecision:
    ip = _client_ip(request)
    ip_hash = _sha256(ip) if ip else None
    fingerprint_hash = _fingerprint(request)
    claims = mongo.free_resume_claims()
    if ip_hash and await claims.find_one({"ipHash": ip_hash, "uid": {"$ne": uid}}, {"_id": 1}):
        return GuardDecision(True, "ip_already_claimed", ip_hash, fingerprint_hash)
    if fingerprint_hash and await claims.find_one({"fingerprintHash": fingerprint_hash, "uid": {"$ne": uid}}, {"_id": 1}):
        return GuardDecision(True, "fingerprint_already_claimed", ip_hash, fingerprint_hash)
    return GuardDecision(False, None, ip_hash, fingerprint_hash)


async def record(uid: str, decision: GuardDecision) -> None:
    await mongo.free_resume_claims().insert_one(
        {"uid": uid, "ipHash": decision.ip_hash, "fingerprintHash": decision.fingerprint_hash, "claimedAt": utcnow()}
    )
