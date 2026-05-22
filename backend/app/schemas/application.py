from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID

from app.models.application import ApplicationStatus


class ApplicationBase(BaseModel):
    job_id: UUID
    resume_id: Optional[UUID] = None
    notes: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    resume_id: Optional[UUID] = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    notes: Optional[str] = None


class ApplicationResponse(ApplicationBase):
    id: UUID
    user_id: UUID
    status: ApplicationStatus
    applied_date: Optional[datetime]
    match_score: Optional[float]
    auto_applied: bool
    cover_letter: Optional[str]
    created_at: datetime
    updated_at: datetime
    job: Optional[dict] = None
    resume: Optional[dict] = None

    class Config:
        from_attributes = True
