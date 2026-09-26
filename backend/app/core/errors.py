"""Error envelope used by every endpoint: {"error": {"code", "message", "details"}}."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)

_DEFAULT_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    402: "PLAN_LIMIT_REACHED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "FILE_TOO_LARGE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_ERROR",
    502: "AI_GENERATION_FAILED",
    503: "SERVICE_UNAVAILABLE",
}


class ApiError(Exception):
    """Raise from anywhere to return a structured error. Extra kwargs are merged into the error object."""

    def __init__(self, status_code: int, code: str, message: str, details: Any = None, **extra: Any) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        self.extra = extra


def error_body(code: str, message: str, details: Any = None, **extra: Any) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details, **extra}}


def not_found(what: str = "Resource") -> ApiError:
    return ApiError(404, "RESOURCE_NOT_FOUND", f"{what} does not exist or you do not have access to it.")


def _validation_details(exc: RequestValidationError) -> list[dict[str, str]]:
    details = []
    for err in exc.errors():
        location = [str(part) for part in err.get("loc", ()) if part not in ("body", "query", "path")]
        details.append({"field": ".".join(location), "message": err.get("msg", "Invalid value")})
    return details


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(error_body(exc.code, exc.message, exc.details, **exc.extra), status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _DEFAULT_CODES.get(exc.status_code, "ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(error_body(code, message), status_code=exc.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            error_body("VALIDATION_ERROR", "Some fields are missing or invalid.", _validation_details(exc)),
            status_code=422,
        )

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            error_body("RATE_LIMIT_EXCEEDED", "Too many requests. Please wait a moment and try again.", str(exc.detail)),
            status_code=429,
        )


class UnhandledErrorMiddleware:
    """Turns unexpected exceptions into a sanitized 500 envelope.

    Added inside the CORS middleware so browsers can still read the error response.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if started:
                raise
            response = JSONResponse(
                error_body("INTERNAL_ERROR", "Something went wrong on our side. Please try again."),
                status_code=500,
            )
            await response(scope, receive, send)
