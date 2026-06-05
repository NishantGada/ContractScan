from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import check_connection
from app.routers import auth

app = FastAPI(title="ContractScan API", version="0.1.0")

# CORS: explicitly list allowed origins — never "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": check_connection()}
