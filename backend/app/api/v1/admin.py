"""Admin API endpoints for platform management and user administration."""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.job import Job
from app.models.application import Application, ApplicationStatus
from app.schemas.user import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_admin(current_user: User) -> None:
    """Ensure the current user is an admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin accounts can access this endpoint",
        )


# ── Platform Dashboard ───────────────────────────────────────────────────────


@router.get("/dashboard")
async def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get platform-wide analytics for the admin dashboard."""
    _require_admin(current_user)

    # User stats
    total_users = db.query(func.count(User.id)).scalar() or 0
    jobseekers = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.JOBSEEKER)
        .scalar()
        or 0
    )
    companies = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.COMPANY)
        .scalar()
        or 0
    )
    admins = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.ADMIN)
        .scalar()
        or 0
    )
    active_users = (
        db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    )

    # Job stats
    total_jobs = db.query(func.count(Job.id)).scalar() or 0
    company_posted_jobs = (
        db.query(func.count(Job.id))
        .filter(Job.source == "company")
        .scalar()
        or 0
    )
    scraped_jobs = total_jobs - company_posted_jobs
    active_jobs = (
        db.query(func.count(Job.id)).filter(Job.is_active == True).scalar() or 0
    )

    # Application stats
    total_applications = db.query(func.count(Application.id)).scalar() or 0
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    applications_today = (
        db.query(func.count(Application.id))
        .filter(Application.created_at >= today_start)
        .scalar()
        or 0
    )

    # Recent user registrations (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users_week = (
        db.query(func.count(User.id))
        .filter(User.created_at >= week_ago)
        .scalar()
        or 0
    )

    return {
        "users": {
            "total": total_users,
            "jobseekers": jobseekers,
            "companies": companies,
            "admins": admins,
            "active": active_users,
            "new_this_week": new_users_week,
        },
        "jobs": {
            "total": total_jobs,
            "company_posted": company_posted_jobs,
            "scraped": scraped_jobs,
            "active": active_jobs,
        },
        "applications": {
            "total": total_applications,
            "today": applications_today,
        },
    }


# ── User Management ──────────────────────────────────────────────────────────


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users with optional role and search filters."""
    _require_admin(current_user)

    query = db.query(User)

    if role:
        try:
            role_enum = UserRole(role)
            query = query.filter(User.role == role_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {role}",
            )

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            func.lower(User.full_name).like(func.lower(search_term))
            | func.lower(User.email).like(func.lower(search_term))
            | func.lower(User.company_name).like(func.lower(search_term))
        )

    users = (
        query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    )
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed info about a specific user."""
    _require_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.post("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activate or deactivate a user account."""
    _require_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = not user.is_active
    db.commit()

    status_text = "activated" if user.is_active else "deactivated"
    return {
        "message": f"User {status_text}",
        "user_id": str(user.id),
        "is_active": user.is_active,
    }


@router.get("/activity/recent")
async def get_recent_activity(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get recent platform activity (registrations, applications, job posts)."""
    _require_admin(current_user)

    recent_users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )
    recent_applications = (
        db.query(Application)
        .order_by(Application.created_at.desc())
        .limit(limit)
        .all()
    )
    recent_jobs = (
        db.query(Job)
        .order_by(Job.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "recent_users": [
            {
                "id": str(u.id),
                "name": u.full_name,
                "email": u.email,
                "role": u.role.value,
                "created_at": u.created_at.isoformat(),
            }
            for u in recent_users
        ],
        "recent_applications": [
            {
                "id": str(a.id),
                "job_title": a.job.title if a.job else "Unknown",
                "company": a.job.company if a.job else "Unknown",
                "applicant": a.user.full_name if a.user else "Unknown",
                "status": a.status.value,
                "created_at": a.created_at.isoformat(),
            }
            for a in recent_applications
        ],
        "recent_jobs": [
            {
                "id": str(j.id),
                "title": j.title,
                "company": j.company,
                "source": j.source,
                "created_at": j.created_at.isoformat(),
            }
            for j in recent_jobs
        ],
    }
