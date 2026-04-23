import time
import uuid

import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

log = structlog.get_logger("axiomate")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs every request with structured key-value pairs.
    Uses structlog contextvars so every log line emitted *during* a request
    automatically carries request_id, method, and path — no manual passing needed.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Clear any context from a previous request (important for async workers)
        clear_contextvars()

        request_id = str(uuid.uuid4())[:8]
        bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        # Make request_id available to route handlers if needed
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        response.headers["X-Request-ID"] = request_id

        log.info(
            "request",
            status=response.status_code,
            duration_ms=round(duration_ms, 1),
        )

        return response
