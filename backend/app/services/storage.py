"""Upload bytes: Cloud Storage when UPLOAD_BUCKET is set, otherwise stored inline in MongoDB.

Objects live under `<UPLOAD_PREFIX>/<uid>/<fileId>` and are removed by `cleanup_expired()` after
UPLOAD_RETENTION_DAYS, matching the TTL on the file records.
"""

import asyncio
import logging
from datetime import timedelta

from bson.binary import Binary

from app.core.config import get_settings
from app.core.utils import utcnow

logger = logging.getLogger(__name__)


def uses_bucket() -> bool:
    return bool(get_settings().upload_bucket)


def _bucket():
    from firebase_admin import storage  # needs google-cloud-storage; imported lazily

    return storage.bucket(get_settings().upload_bucket)


def object_name(uid: str, file_id: str) -> str:
    return f"{get_settings().upload_prefix.strip('/')}/{uid}/{file_id}"


async def put(uid: str, file_id: str, data: bytes, content_type: str) -> dict:
    """Stores the bytes and returns the fields to save on the file record."""
    if not uses_bucket():
        return {"data": Binary(data), "storage": "mongo"}
    name = object_name(uid, file_id)

    def _upload() -> None:
        blob = _bucket().blob(name)
        blob.upload_from_string(data, content_type=content_type)

    await asyncio.to_thread(_upload)
    return {"storage": "bucket", "objectName": name}


async def get(doc: dict) -> bytes | None:
    if doc.get("storage") != "bucket":
        return bytes(doc["data"]) if doc.get("data") is not None else None

    def _download() -> bytes | None:
        blob = _bucket().blob(doc["objectName"])
        return blob.download_as_bytes() if blob.exists() else None

    return await asyncio.to_thread(_download)


async def delete(doc: dict) -> None:
    if doc.get("storage") != "bucket":
        return

    def _delete() -> None:
        blob = _bucket().blob(doc["objectName"])
        if blob.exists():
            blob.delete()

    await asyncio.to_thread(_delete)


async def delete_user_objects(uid: str) -> None:
    if not uses_bucket():
        return
    prefix = f"{get_settings().upload_prefix.strip('/')}/{uid}/"
    await asyncio.to_thread(lambda: [blob.delete() for blob in _bucket().list_blobs(prefix=prefix)])


async def cleanup_expired() -> int:
    """Deletes uploaded objects older than the retention period. Returns how many were removed."""
    if not uses_bucket():
        return 0
    settings = get_settings()
    cutoff = utcnow() - timedelta(days=settings.upload_retention_days)

    def _cleanup() -> int:
        removed = 0
        for blob in _bucket().list_blobs(prefix=f"{settings.upload_prefix.strip('/')}/"):
            if blob.time_created and blob.time_created < cutoff:
                blob.delete()
                removed += 1
        return removed

    removed = await asyncio.to_thread(_cleanup)
    if removed:
        logger.info("Removed %d expired uploads from storage.", removed)
    return removed
