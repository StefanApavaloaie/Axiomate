import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import sys
import asyncio

# Apply Windows event loop fix for psycopg if running on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.config import settings
from app.core.middleware import RequestLoggingMiddleware

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("axiomate")


# ── Lifespan (startup / shutdown hooks) ───────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME}...")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


# ── Rate Limiter ────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["600/minute"])

# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    description="SaaS analytics platform API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

# ── Middleware ─────────────────────────────────────────────────────────────────
# Production CORS: only allow our own frontend origin.
# The wildcard allow_origin_regex=".*" was removed — it allowed ANY website
# to make credentialed API calls on behalf of logged-in users (CSRF risk).
ALLOWED = list({
    "http://localhost",
    "http://localhost:80",
    "http://localhost:5173",      # Vite dev server
    *settings.ALLOWED_ORIGINS,   # Additional origins from .env
})
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Workspace-ID", "X-API-Key"],
)
app.add_middleware(RequestLoggingMiddleware)


# ── Open CORS for the public ingest endpoint ───────────────────────────────────
# The /ingest/ endpoint is a public SDK endpoint consumed by any customer website.
# Its security comes from the X-API-Key header, NOT from origin restrictions.
# We manually inject the necessary CORS headers for OPTIONS preflight requests.
@app.middleware("http")
async def ingest_cors_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/v1/ingest"):
        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-API-Key"
        return response
    return await call_next(request)


# ── Routers ───────────────────────────────────────────────────────────────────
# We import routers here to avoid circular imports at module level
from app.api.v1 import auth, workspaces, api_keys, ingest  # noqa: E402
from app.api.v1 import dashboards, funnels, retention       # noqa: E402
from app.api.v1 import anomalies, reports, ai, users        # noqa: E402

PREFIX = "/api/v1"

app.include_router(auth.router,        prefix=PREFIX, tags=["Auth"])
app.include_router(users.router,       prefix=PREFIX, tags=["Users"])
app.include_router(workspaces.router,  prefix=PREFIX, tags=["Workspaces"])
app.include_router(api_keys.router,    prefix=PREFIX, tags=["API Keys"])
app.include_router(ingest.router,      prefix=PREFIX, tags=["Ingestion"])
app.include_router(dashboards.router,  prefix=PREFIX, tags=["Dashboards"])
app.include_router(funnels.router,     prefix=PREFIX, tags=["Funnels"])
app.include_router(retention.router,   prefix=PREFIX, tags=["Retention"])
app.include_router(anomalies.router,   prefix=PREFIX, tags=["Anomalies"])
app.include_router(reports.router,     prefix=PREFIX, tags=["Reports"])
app.include_router(ai.router,          prefix=PREFIX, tags=["AI"])


# ── Health check ──────────────────────────────────────────────────────────────
# Returns only { "status": "ok" } — enough for load balancers, nothing for
# attackers. Never expose app name, version, or env details here.
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}
