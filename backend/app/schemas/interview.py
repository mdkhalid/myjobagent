from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID

from app.models.interview import InterviewType, InterviewStatus


class InterviewBase(BaseModel):
    application_id: UUID
    interview_type: InterviewType
    scheduled_date: datetime
    duration_minutes: int = 60
    notes: Optional[str] = None
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[str] = None
    location: Optional[str] = None


class InterviewCreate(InterviewBase):
    pass


class InterviewUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[InterviewStatus] = None
    notes: Optional[str] = None
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[str] = None
    location: Optional[str] = None


class InterviewResponse(InterviewBase):
    id: UUID
    status: InterviewStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
