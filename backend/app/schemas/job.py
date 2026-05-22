from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel
from uuid import UUID

from app.models.job import JobType


class JobBase(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: List[str] = []
    skills_required: List[str] = []
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    salary_currency: str = "USD"
    job_type: JobType = JobType.FULL_TIME
    source: Optional[str] = None
    external_url: Optional[str] = None


class JobCreate(JobBase):
    external_id: Optional[str] = None
    posted_date: Optional[datetime] = None


class JobResponse(JobBase):
    id: UUID
    external_id: Optional[str]
    posted_date: Optional[datetime]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class JobSearchParams(BaseModel):
    keywords: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[JobType] = None
    skills: List[str] = []
    min_salary: Optional[int] = None
    max_salary: Optional[int] = None
    page: int = 1
    page_size: int = 20


class JobMatchResult(JobResponse):
    match_score: float
    matching_skills: List[str]
    missing_skills: List[str]
