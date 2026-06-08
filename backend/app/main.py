import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import check_connection
from app.routers import analysis, auth, contracts, dashboard, vendors

# Log through uvicorn's logger so these lines use uvicorn's handler/level and
# actually show up — the root logger is unconfigured under uvicorn (default
# level WARNING, no handler), which would silently drop an INFO line.
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Make it obvious on every (re)start what the analysis pipeline will do —
    # mock mode means no real API calls; otherwise log which LLM is active.
    if settings.USE_MOCK_GEMINI:
        logger.warning("LLM analysis MOCKED (USE_MOCK_GEMINI=true) — no real API calls")
    else:
        logger.info("LLM provider active: %s", settings.LLM_PROVIDER)
    yield


app = FastAPI(title="ContractScan API", version="0.1.0", lifespan=lifespan)

# CORS: explicitly list allowed origins — never "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(vendors.router)
app.include_router(contracts.router)
app.include_router(analysis.router)
app.include_router(dashboard.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": check_connection()}
