"""Role-based dashboard endpoint.

Returns different data depending on the user's role:
- jobseeker → application stats, recent apps, recommendations
- company   → job posting stats, recent applicants
- admin     → platform analytics, user stats
"""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.job import Job
from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewStatus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_role_based_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return dashboard data tailored to the user's role."""
    role = current_user.role

    if role == UserRole.JOBSEEKER:
        return _jobseeker_dashboard(db, current_user)
    elif role == UserRole.COMPANY:
        return _company_dashboard(db, current_user)
    elif role == UserRole.ADMIN:
        return _admin_dashboard(db, current_user)

    return {"role": role, "data": {}}


def _jobseeker_dashboard(db: Session, user: User) -> dict:
    """Jobseeker dashboard: application stats, recent apps, top match."""
    total_applications = (
        db.query(func.count(Application.id))
        .filter(Application.user_id == user.id)
        .scalar()
        or 0
    )

    status_counts = (
        db.query(
            Application.status,
            func.count(Application.id).label("count"),
        )
        .filter(Application.user_id == user.id)
        .group_by(Application.status)
        .all()
    )

    by_status = {s.status.value: s.count for s in status_counts}

    # Recent applications
    recent_applications = (
        db.query(Application)
        .filter(Application.user_id == user.id)
        .order_by(Application.created_at.desc())
        .limit(5)
        .all()
    )

    # Upcoming interviews
    upcoming_interviews = (
        db.query(Interview)
        .join(Application)
        .filter(
            Application.user_id == user.id,
            Interview.scheduled_date >= datetime.now(timezone.utc),
            Interview.status == InterviewStatus.SCHEDULED,
        )
        .order_by(Interview.scheduled_date)
        .limit(5)
        .all()
    )

    # Resume check
    has_resume = bool(user.resumes)

    return {
        "role": "jobseeker",
        "stats": {
            "total_applications": total_applications,
            "by_status": by_status,
            "pending": by_status.get("pending", 0),
            "applied": by_status.get("applied", 0),
            "interviews": by_status.get("interview", 0),
            "offers": by_status.get("offer", 0),
        },
        "recent_applications": [
            {
                "id": str(a.id),
                "job_title": a.job.title if a.job else "Unknown",
                "company": a.job.company if a.job else "Unknown",
                "status": a.status.value,
                "applied_date": a.applied_date.isoformat() if a.applied_date else None,
                "match_score": a.match_score,
            }
            for a in recent_applications
        ],
        "upcoming_interviews": [
            {
                "id": str(i.id),
                "type": i.interview_type.value,
                "scheduled_date": i.scheduled_date.isoformat(),
                "company": i.application.job.company if i.application.job else "Unknown",
                "job_title": i.application.job.title if i.application.job else "Unknown",
            }
            for i in upcoming_interviews
        ],
        "has_resume": has_resume,
    }


def _company_dashboard(db: Session, user: User) -> dict:
    """Company dashboard: job postings, applicant stats."""
    jobs = (
        db.query(Job)
        .filter(Job.poster_id == user.id)
        .order_by(Job.created_at.desc())
        .all()
    )

    active_jobs = [j for j in jobs if j.is_active]
    total_applicants = 0
    if jobs:
        total_applicants = (
            db.query(func.count(Application.id))
            .filter(Application.job_id.in_([j.id for j in jobs]))
            .scalar()
            or 0
        )

    return {
        "role": "company",
        "stats": {
            "total_jobs": len(jobs),
            "active_jobs": len(active_jobs),
            "total_applicants": total_applicants,
        },
        "company_name": user.company_name or user.full_name,
        "recent_jobs": [
            {
                "id": str(j.id),
                "title": j.title,
                "location": j.location,
                "is_active": j.is_active,
                "posted_date": j.posted_date.isoformat() if j.posted_date else None,
                "applicant_count": (
                    db.query(func.count(Application.id))
                    .filter(Application.job_id == j.id)
                    .scalar()
                    or 0
                ),
            }
            for j in jobs[:5]
        ],
    }


def _admin_dashboard(db: Session, user: User) -> dict:
    """Admin dashboard: platform-wide stats."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_jobs = db.query(func.count(Job.id)).scalar() or 0
    total_apps = db.query(func.count(Application.id)).scalar() or 0

    role_counts = (
        db.query(User.role, func.count(User.id).label("count"))
        .group_by(User.role)
        .all()
    )
    by_role = {r.role.value: r.count for r in role_counts}

    return {
        "role": "admin",
        "stats": {
            "total_users": total_users,
            "total_jobs": total_jobs,
            "total_applications": total_apps,
            "users_by_role": by_role,
        },
    }
