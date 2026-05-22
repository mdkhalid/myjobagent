from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.job import Job
from app.models.resume import Resume
from app.models.application import Application, ApplicationStatus
from app.services.auto_apply_service import AutoApplyService
from app.services.matching_service import calculate_match_score
from app.tasks.auto_apply_tasks import auto_apply_task

router = APIRouter()

# In-memory storage for automation status (use Redis in production)
automation_status = {}


class AutoApplySettings:
    def __init__(self):
        self.min_match_score = 70.0
        self.daily_limit = 10
        self.companies_exclude = []
        self.job_titles_target = []
        self.auto_submit = False


@router.get("/status")
async def get_automation_status(
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    status = automation_status.get(user_id, {
        "is_running": False,
        "jobs_queued": 0,
        "jobs_applied_today": 0,
        "last_run": None
    })
    return status


@router.post("/start")
async def start_auto_apply(
    min_match_score: float = 70.0,
    daily_limit: int = 10,
    companies_exclude: List[str] = [],
    job_titles_target: List[str] = [],
    auto_submit: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    
    # Check if already running
    if automation_status.get(user_id, {}).get("is_running", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auto-apply is already running"
        )
    
    # Get active resume
    resume = db.query(Resume).filter(
        Resume.user_id == current_user.id,
        Resume.is_active == True
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active resume found. Please upload and activate a resume first."
        )
    
    # Update status
    automation_status[user_id] = {
        "is_running": True,
        "min_match_score": min_match_score,
        "daily_limit": daily_limit,
        "companies_exclude": companies_exclude,
        "job_titles_target": job_titles_target,
        "auto_submit": auto_submit,
        "jobs_queued": 0,
        "jobs_applied_today": 0,
        "last_run": datetime.utcnow().isoformat()
    }
    
    # Trigger auto-apply task (skip if broker not available)
    try:
        auto_apply_task.delay(
            user_id=user_id,
            resume_id=str(resume.id),
            min_match_score=min_match_score,
            daily_limit=daily_limit,
            companies_exclude=companies_exclude,
            job_titles_target=job_titles_target,
            auto_submit=auto_submit
        )
        return {
            "message": "Auto-apply started",
            "status": "running",
            "min_match_score": min_match_score,
            "daily_limit": daily_limit,
            "companies_exclude": companies_exclude,
            "job_titles_target": job_titles_target,
            "auto_submit": auto_submit,
            "jobs_queued": 0,
            "jobs_applied_today": 0,
            "last_run": datetime.utcnow().isoformat()
        }
    except Exception:
        return {
            "message": "Auto-apply unavailable (broker not running)",
            "status": "unavailable",
            "min_match_score": min_match_score,
            "daily_limit": daily_limit,
            "companies_exclude": companies_exclude,
            "job_titles_target": job_titles_target,
            "auto_submit": auto_submit
        }


@router.post("/stop")
async def stop_auto_apply(
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    
    if user_id not in automation_status:
        automation_status[user_id] = {}
    
    automation_status[user_id]["is_running"] = False
    
    return {"message": "Auto-apply stopped"}


@router.get("/queue")
async def get_approval_queue(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get jobs queued for approval before applying"""
    # Get pending applications created by auto-apply
    applications = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.status == ApplicationStatus.PENDING,
        Application.auto_applied == False
    ).order_by(Application.match_score.desc()).limit(limit).all()
    
    result = []
    for app in applications:
        result.append({
            "application_id": str(app.id),
            "job": {
                "id": str(app.job.id),
                "title": app.job.title,
                "company": app.job.company,
                "location": app.job.location,
                "external_url": app.job.external_url
            },
            "match_score": app.match_score,
            "created_at": app.created_at.isoformat()
        })
    
    return result


@router.post("/approve/{application_id}")
async def approve_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Submit the application
    from app.services.auto_apply_service import submit_application
    try:
        result = submit_application(application)
        application.status = ApplicationStatus.APPLIED
        application.applied_date = datetime.utcnow()
        db.commit()
        
        return {"message": "Application approved and submitted", "result": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit application: {str(e)}"
        )


@router.post("/reject/{application_id}")
async def reject_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Mark as withdrawn/rejected by user
    application.status = ApplicationStatus.WITHDRAWN
    db.commit()
    
    return {"message": "Application rejected"}


@router.get("/settings")
async def get_auto_apply_settings(
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    settings = automation_status.get(user_id, {
        "min_match_score": 70.0,
        "daily_limit": 10,
        "companies_exclude": [],
        "job_titles_target": [],
        "auto_submit": False
    })
    return settings


@router.post("/settings")
async def update_auto_apply_settings(
    settings: dict,
    current_user: User = Depends(get_current_user)
):
    user_id = str(current_user.id)
    
    if user_id not in automation_status:
        automation_status[user_id] = {}
    
    # Update settings
    automation_status[user_id].update(settings)
    
    return {"message": "Settings updated", "settings": automation_status[user_id]}
