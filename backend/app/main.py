from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (ensure models are registered on Base)
from .config import settings
from .database import Base, SessionLocal, engine
from .routers import applications, positions, profile, recommendations, research
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and optionally seed sample data on startup.
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            seed(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="PostdocEngine API",
    description=(
        "Backend for PostdocEngine — a postdoc job finder, application tracker, "
        "match/recommendation engine, and research productivity tool."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(positions.router)
app.include_router(applications.router)
app.include_router(research.router)
app.include_router(recommendations.router)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "postdocengine"}


@app.get("/api/meta/enums", tags=["meta"])
def enums():
    """Expose the allowed enum values so the frontend stays in sync."""
    return {
        "application_statuses": models.APPLICATION_STATUSES,
        "research_types": models.RESEARCH_TYPES,
        "research_statuses": models.RESEARCH_STATUSES,
    }
