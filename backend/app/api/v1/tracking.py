from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.application import Application, ApplicationStatus
from app.models.interview import Interview, InterviewType, InterviewStatus
from app.schemas.interview import InterviewCreate, InterviewResponse, InterviewUpdate

router = APIRouter()


@router.get("/stats")
async def get_tracking_stats(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive application statistics"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Overall stats
    total_applications = db.query(Application).filter(
        Application.user_id == current_user.id
    ).count()
    
    # Status breakdown
    status_counts = db.query(
        Application.status,
        func.count(Application.id).label("count")
    ).filter(
        Application.user_id == current_user.id
    ).group_by(Application.status).all()
    
    # Recent applications
    recent_count = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.created_at >= start_date
    ).count()
    
    # Interviews scheduled
    upcoming_interviews = db.query(Interview).join(Application).filter(
        Application.user_id == current_user.id,
        Interview.scheduled_date >= datetime.utcnow(),
        Interview.status == InterviewStatus.SCHEDULED
    ).count()
    
    # Conversion rates
    applied_count = sum(1 for s in status_counts if s.status in [ApplicationStatus.APPLIED, ApplicationStatus.SCREENING, ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER])
    interview_count = sum(1 for s in status_counts if s.status == ApplicationStatus.INTERVIEW)
    offer_count = sum(1 for s in status_counts if s.status == ApplicationStatus.OFFER)
    
    return {
        "total_applications": total_applications,
        "recent_applications": recent_count,
        "by_status": {s.status.value: s.count for s in status_counts},
        "upcoming_interviews": upcoming_interviews,
        "conversion_rates": {
            "application_to_interview": (interview_count / applied_count * 100) if applied_count > 0 else 0,
            "interview_to_offer": (offer_count / interview_count * 100) if interview_count > 0 else 0,
            "application_to_offer": (offer_count / applied_count * 100) if applied_count > 0 else 0
        }
    }


@router.get("/timeline")
async def get_application_timeline(
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get application timeline for visualization"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    applications = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.created_at >= start_date
    ).order_by(Application.created_at).all()
    
    timeline = []
    for app in applications:
        timeline.append({
            "date": app.created_at.isoformat(),
            "job_title": app.job.title if app.job else "Unknown",
            "company": app.job.company if app.job else "Unknown",
            "status": app.status.value,
            "match_score": app.match_score
        })
    
    return timeline


@router.post("/interviews", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    interview_data: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify application exists and belongs to user
    application = db.query(Application).filter(
        Application.id == interview_data.application_id,
        Application.user_id == current_user.id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    interview = Interview(**interview_data.dict())
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    # Update application status to interview
    application.status = ApplicationStatus.INTERVIEW
    db.commit()
    
    return interview


@router.get("/interviews", response_model=List[InterviewResponse])
async def get_interviews(
    upcoming_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Interview).join(Application).filter(
        Application.user_id == current_user.id
    )
    
    if upcoming_only:
        query = query.filter(
            Interview.scheduled_date >= datetime.utcnow(),
            Interview.status == InterviewStatus.SCHEDULED
        )
    
    interviews = query.order_by(Interview.scheduled_date).all()
    return interviews


@router.get("/interviews/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    interview = db.query(Interview).join(Application).filter(
        Interview.id == interview_id,
        Application.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    return interview


@router.put("/interviews/{interview_id}", response_model=InterviewResponse)
async def update_interview(
    interview_id: str,
    interview_data: InterviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    interview = db.query(Interview).join(Application).filter(
        Interview.id == interview_id,
        Application.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    # Update fields
    update_data = interview_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(interview, field, value)
    
    interview.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(interview)
    
    return interview


@router.delete("/interviews/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    interview = db.query(Interview).join(Application).filter(
        Interview.id == interview_id,
        Application.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    db.delete(interview)
    db.commit()
    
    return None


@router.get("/dashboard")
async def get_dashboard_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all dashboard data in one call"""
    # Stats
    stats = await get_tracking_stats(db=db, current_user=current_user)
    
    # Upcoming interviews
    upcoming_interviews = db.query(Interview).join(Application).filter(
        Application.user_id == current_user.id,
        Interview.scheduled_date >= datetime.utcnow(),
        Interview.status == InterviewStatus.SCHEDULED
    ).order_by(Interview.scheduled_date).limit(5).all()
    
    # Recent applications
    recent_applications = db.query(Application).filter(
        Application.user_id == current_user.id
    ).order_by(Application.created_at.desc()).limit(5).all()
    
    return {
        "stats": stats,
        "upcoming_interviews": [
            {
                "id": str(i.id),
                "type": i.interview_type.value,
                "scheduled_date": i.scheduled_date.isoformat(),
                "company": i.application.job.company if i.application.job else "Unknown",
                "job_title": i.application.job.title if i.application.job else "Unknown"
            }
            for i in upcoming_interviews
        ],
        "recent_applications": [
            {
                "id": str(a.id),
                "job_title": a.job.title if a.job else "Unknown",
                "company": a.job.company if a.job else "Unknown",
                "status": a.status.value,
                "applied_date": a.applied_date.isoformat() if a.applied_date else None,
                "match_score": a.match_score
            }
            for a in recent_applications
        ]
    }
