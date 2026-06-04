"""Schemas for company job posting and applicant tracking."""

from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from uuid import UUID

from app.models.job import JobType


class CompanyJobCreate(BaseModel):
    """Schema for companies creating a job posting."""
    title: str = Field(..., min_length=1, max_length=200)
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: List[str] = []
    skills_required: List[str] = []
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    salary_currency: str = "USD"
    job_type: JobType = JobType.FULL_TIME
    is_active: bool = True


class CompanyJobUpdate(BaseModel):
    """Schema for updating a company's job posting."""
    title: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    skills_required: Optional[List[str]] = None
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    salary_currency: Optional[str] = None
    job_type: Optional[JobType] = None
    is_active: Optional[bool] = None


class ApplicantInfo(BaseModel):
    """Summary of an applicant for a job."""
    application_id: UUID
    applicant_id: UUID
    applicant_name: str
    applicant_email: str
    status: str
    match_score: Optional[float] = None
    applied_date: Optional[datetime] = None
    resume_filename: Optional[str] = None
    has_interview: bool = False


class CompanyJobResponse(BaseModel):
    """A company's job posting with applicant count."""
    id: UUID
    title: str
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: List[str]
    skills_required: List[str]
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    salary_currency: str
    job_type: JobType
    is_active: bool
    posted_date: Optional[datetime] = None
    applicant_count: int = 0
    new_applicants: int = 0

    class Config:
        from_attributes = True


class CompanyDashboardResponse(BaseModel):
    """Company dashboard data."""
    total_jobs: int
    active_jobs: int
    total_applicants: int
    new_applicants_today: int
    recent_jobs: List[CompanyJobResponse]
    company_name: str
