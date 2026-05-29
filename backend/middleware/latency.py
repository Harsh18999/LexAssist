"""
Latency logging middleware for JurisAI.

Every request gets:
  - X-Response-Time: <ms>ms header in the response
  - A structured log line: METHOD /path → STATUS in XXms

Streaming responses (SSE) are excluded from body-level timing but
still get the request-start → first-byte header stamped correctly.
"""
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("jurisai.latency")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Paths to skip verbose logging (health checks, static assets)
_SKIP_PATHS = {"/api/health", "/favicon.ico"}


class LatencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        path = request.url.path

        response: Response = await call_next(request)

        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Response-Time"] = f"{elapsed_ms}ms"

        if path not in _SKIP_PATHS:
            status = response.status_code
            method = request.method
            # Colour-code in terminal: green <400, yellow 4xx, red 5xx
            level = logging.INFO if status < 400 else (logging.WARNING if status < 500 else logging.ERROR)
            logger.log(level, "%s %s → %s  [%sms]", method, path, status, elapsed_ms)

        return response
