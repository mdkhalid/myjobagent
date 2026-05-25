from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.db.session import engine
from app.models.base import Base
from app.api.v1 import auth, users, resumes, jobs, applications, automation, tracking, linkedin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown


app = FastAPI(
    title="Job Agent API",
    description="AI-powered job search and application automation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:80"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(resumes.router, prefix="/api/v1/resumes", tags=["resumes"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/api/v1/applications", tags=["applications"])
app.include_router(automation.router, prefix="/api/v1/automation", tags=["automation"])
app.include_router(tracking.router, prefix="/api/v1/tracking", tags=["tracking"])
app.include_router(linkedin.router, prefix="/api/v1/job-search", tags=["job-search"])


@app.get("/")
async def root():
    return {"message": "Welcome to Job Agent API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
