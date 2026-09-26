"""AI model access through the provider SDK, either inside the GCP project (service account) or with an API key.

Model IDs come from configuration (AI_MODEL, AI_MODEL_LITE). Output is validated against Pydantic
schemas (structured output) and calls are async with retries for transient failures.
"""

import asyncio
import logging
import random
from typing import TypeVar

import httpx
from google import genai
from google.genai import errors as provider_errors
from google.genai import types
from google.oauth2 import service_account
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
_RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3

_client: genai.Client | None = None


class AIUnavailableError(Exception):
    """The AI provider could not be reached or is not configured (maps to 503)."""


class AIResponseError(Exception):
    """The model answered, but not with usable output (maps to 502)."""


def is_configured() -> bool:
    settings = get_settings()
    has_access = settings.ai_use_cloud_project or bool(settings.ai_api_key)
    return bool(settings.ai_model and settings.ai_model_lite and has_access)


def get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    if not is_configured():
        raise AIUnavailableError("AI features are not configured on the server.")
    http_options = types.HttpOptions(timeout=int(settings.ai_timeout_seconds * 1000))
    if settings.ai_use_cloud_project:
        creds_path = settings.resolve_path(settings.ai_credentials_file)
        credentials = None
        if creds_path.exists():
            credentials = service_account.Credentials.from_service_account_file(str(creds_path), scopes=[_CLOUD_PLATFORM_SCOPE])
        else:
            logger.warning("AI credentials file %s not found; using Application Default Credentials.", creds_path)
        _client = genai.Client(
            vertexai=True,
            project=settings.ai_cloud_project,
            location=settings.ai_cloud_location,
            credentials=credentials,
            http_options=http_options,
        )
    else:
        _client = genai.Client(api_key=settings.ai_api_key, http_options=http_options)
    return _client


def _thinking_config(lite: bool) -> types.ThinkingConfig | None:
    level = get_settings().ai_thinking_level.strip().lower()
    if not level:
        return None
    return types.ThinkingConfig(thinking_level="minimal" if lite else level)


async def generate_structured(
    *,
    contents: str | list[types.Part],
    schema: type[T],
    system_instruction: str | None = None,
    lite: bool = False,
    temperature: float = 0.4,
) -> T:
    """Calls the AI model with a response schema and returns the validated Pydantic object."""
    settings = get_settings()
    client = get_client()
    model = settings.ai_model_lite if lite else settings.ai_model
    tier = "lite" if lite else "main"
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=temperature,
        response_mime_type="application/json",
        response_schema=schema,
        thinking_config=_thinking_config(lite),
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    last_error: Exception | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            response = await client.aio.models.generate_content(model=model, contents=contents, config=config)
        except provider_errors.APIError as exc:
            last_error = exc
            if exc.code in _RETRYABLE_STATUS and attempt < _MAX_ATTEMPTS:
                await _backoff(attempt, tier, exc)
                continue
            logger.error("AI model (%s) request failed (%s): %s", tier, exc.code, exc)
            if exc.code in _RETRYABLE_STATUS:
                raise AIUnavailableError("The AI service is busy. Please try again in a moment.") from exc
            raise AIResponseError("The AI service rejected the request.") from exc
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            last_error = exc
            if attempt < _MAX_ATTEMPTS:
                await _backoff(attempt, tier, exc)
                continue
            raise AIUnavailableError("Could not reach the AI service. Please try again.") from exc

        parsed = response.parsed
        if isinstance(parsed, schema):
            return parsed
        try:
            return schema.model_validate_json(response.text or "")
        except (ValidationError, ValueError) as exc:
            last_error = exc
            logger.warning("AI model (%s) output failed validation (attempt %d): %s", tier, attempt, exc)

    raise AIResponseError("The AI returned an unexpected response. Please try again.") from last_error


async def _backoff(attempt: int, tier: str, exc: Exception) -> None:
    delay = (2 ** (attempt - 1)) + random.uniform(0, 0.5)
    logger.warning("AI model (%s) attempt %d failed (%s); retrying in %.1fs", tier, attempt, exc, delay)
    await asyncio.sleep(delay)
