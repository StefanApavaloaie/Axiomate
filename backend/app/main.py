import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# ── Middleware ─────────────────────────────────────────────────────────────────
# Order matters: CORSMiddleware must be added before custom middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)


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
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
