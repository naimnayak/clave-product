"""Small helpers shared by routers and services."""

import uuid
from datetime import UTC, datetime
from typing import Any


def utcnow() -> datetime:
    return datetime.now(UTC)


def iso(value: datetime | None) -> str | None:
    """ISO 8601 UTC with a trailing Z, as the frontend expects."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex}" if prefix else str(uuid.uuid4())


def ok(data: Any = None, message: str | None = None) -> dict[str, Any]:
    """Success envelope: {"data": ..., "message": ...}."""
    body: dict[str, Any] = {"data": data}
    if message:
        body["message"] = message
    return body


def drop_none(values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if value is not None}
