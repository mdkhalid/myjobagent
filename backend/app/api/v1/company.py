"""Company API endpoints for managing job postings and applicants."""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.job import Job, JobType
from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewStatus
from app.schemas.company import (
    CompanyJobCreate,
    CompanyJobUpdate,
    CompanyJobResponse,
    CompanyDashboardResponse,
    ApplicantInfo,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_company(current_user: User) -> None:
    """Ensure the current user is a company account."""
    if current_user.role != UserRole.COMPANY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company accounts can access this endpoint",
        )


# ── Dashboard ────────────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=CompanyDashboardResponse)
async def get_company_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get company dashboard with job and applicant stats."""
    _require_company(current_user)

    # Get all jobs posted by this company
    jobs = (
        db.query(Job)
        .filter(Job.poster_id == current_user.id)
        .order_by(Job.created_at.desc())
        .all()
    )

    active_jobs = [j for j in jobs if j.is_active]
    total_applicants = (
        db.query(func.count(Application.id))
        .filter(Application.job_id.in_([j.id for j in jobs]))
        .scalar()
        if jobs
        else 0
    )

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    new_today = (
        db.query(func.count(Application.id))
        .filter(
            Application.job_id.in_([j.id for j in jobs]),
            Application.created_at >= today_start,
        )
        .scalar()
        if jobs
        else 0
    )

    recent_jobs = []
    for j in jobs[:5]:
        applicant_count = (
            db.query(func.count(Application.id))
            .filter(Application.job_id == j.id)
            .scalar()
            or 0
        )
        recent_jobs.append(
            CompanyJobResponse(
                id=j.id,
                title=j.title,
                location=j.location,
                description=j.description,
                requirements=j.requirements or [],
                skills_required=j.skills_required or [],
                salary_min=j.salary_min,
                salary_max=j.salary_max,
                salary_currency=j.salary_currency,
                job_type=j.job_type,
                is_active=j.is_active,
                posted_date=j.posted_date,
                applicant_count=applicant_count,
                new_applicants=0,
            )
        )

    return CompanyDashboardResponse(
        total_jobs=len(jobs),
        active_jobs=len(active_jobs),
        total_applicants=total_applicants or 0,
        new_applicants_today=new_today or 0,
        recent_jobs=recent_jobs,
        company_name=current_user.company_name or current_user.full_name,
    )


# ── Job CRUD ─────────────────────────────────────────────────────────────────


@router.get("/jobs", response_model=List[CompanyJobResponse])
async def get_company_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all job postings by the company."""
    _require_company(current_user)

    jobs = (
        db.query(Job)
        .filter(Job.poster_id == current_user.id)
        .order_by(Job.created_at.desc())
        .all()
    )

    result = []
    for j in jobs:
        applicant_count = (
            db.query(func.count(Application.id))
            .filter(Application.job_id == j.id)
            .scalar()
            or 0
        )
        new_count = (
            db.query(func.count(Application.id))
            .filter(
                Application.job_id == j.id,
                Application.status == ApplicationStatus.PENDING,
            )
            .scalar()
            or 0
        )
        result.append(
            CompanyJobResponse(
                id=j.id,
                title=j.title,
                location=j.location,
                description=j.description,
                requirements=j.requirements or [],
                skills_required=j.skills_required or [],
                salary_min=j.salary_min,
                salary_max=j.salary_max,
                salary_currency=j.salary_currency,
                job_type=j.job_type,
                is_active=j.is_active,
                posted_date=j.posted_date,
                applicant_count=applicant_count,
                new_applicants=new_count,
            )
        )

    return result


@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def create_job_posting(
    job_data: CompanyJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new job posting as a company."""
    _require_company(current_user)

    job = Job(
        title=job_data.title,
        company=current_user.company_name or current_user.full_name,
        location=job_data.location,
        description=job_data.description,
        requirements=job_data.requirements or [],
        skills_required=job_data.skills_required or [],
        salary_min=job_data.salary_min,
        salary_max=job_data.salary_max,
        salary_currency=job_data.salary_currency,
        job_type=job_data.job_type,
        source="company",
        external_id=None,
        external_url=None,
        posted_date=datetime.now(timezone.utc),
        is_active=job_data.is_active,
        poster_id=current_user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return {
        "message": "Job posting created successfully",
        "job_id": str(job.id),
        "title": job.title,
    }


@router.put("/jobs/{job_id}")
async def update_job_posting(
    job_id: str,
    job_data: CompanyJobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a company's job posting."""
    _require_company(current_user)

    job = (
        db.query(Job)
        .filter(Job.id == job_id, Job.poster_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    update_data = job_data.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)
    return {"message": "Job posting updated", "job_id": str(job.id)}


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_posting(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a company's job posting."""
    _require_company(current_user)

    job = (
        db.query(Job)
        .filter(Job.id == job_id, Job.poster_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    db.delete(job)
    db.commit()
    return None


# ── Applicants ───────────────────────────────────────────────────────────────


@router.get("/jobs/{job_id}/applicants", response_model=List[ApplicantInfo])
async def get_job_applicants(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all applicants for a specific job posting."""
    _require_company(current_user)

    job = (
        db.query(Job)
        .filter(Job.id == job_id, Job.poster_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    applications = (
        db.query(Application)
        .filter(Application.job_id == job.id)
        .order_by(Application.created_at.desc())
        .all()
    )

    result = []
    for app in applications:
        applicant = db.query(User).filter(User.id == app.user_id).first()
        has_interview = bool(
            db.query(Interview)
            .filter(
                Interview.application_id == app.id,
                Interview.status == InterviewStatus.SCHEDULED,
            )
            .first()
        )
        resume_name = None
        if app.resume:
            resume_name = app.resume.filename

        result.append(
            ApplicantInfo(
                application_id=app.id,
                applicant_id=app.user_id,
                applicant_name=applicant.full_name if applicant else "Unknown",
                applicant_email=applicant.email if applicant else "",
                status=app.status.value if app.status else "pending",
                match_score=app.match_score,
                applied_date=app.applied_date,
                resume_filename=resume_name,
                has_interview=has_interview,
            )
        )

    return result


@router.put("/applications/{application_id}/status")
async def update_applicant_status(
    application_id: str,
    new_status: ApplicationStatus = Query(..., description="New status for the application"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the status of an applicant (e.g. to interview, offer, reject)."""
    _require_company(current_user)

    application = (
        db.query(Application)
        .join(Job)
        .filter(
            Application.id == application_id,
            Job.poster_id == current_user.id,
        )
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found or not authorized",
        )

    application.status = new_status
    application.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": f"Application status updated to {new_status.value}",
        "application_id": str(application.id),
    }
