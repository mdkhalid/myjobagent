from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.job import Job
from app.models.resume import Resume
from app.models.application import Application, ApplicationStatus
from app.schemas.application import (
    ApplicationCreate, 
    ApplicationResponse, 
    ApplicationUpdate,
    ApplicationStatusUpdate
)
from app.services.application_service import create_application_with_cover_letter
from app.services.auto_apply_service import submit_application

router = APIRouter()


@router.get("/", response_model=List[ApplicationResponse])
async def get_applications(
    status: Optional[ApplicationStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Application).filter(Application.user_id == current_user.id)
    
    if status:
        query = query.filter(Application.status == status)
    
    applications = query.order_by(Application.created_at.desc()).offset(skip).limit(limit).all()
    
    # Enrich with job and resume data
    result = []
    for app in applications:
        app_dict = {
            "id": app.id,
            "user_id": app.user_id,
            "job_id": app.job_id,
            "resume_id": app.resume_id,
            "status": app.status,
            "applied_date": app.applied_date,
            "notes": app.notes,
            "match_score": app.match_score,
            "auto_applied": app.auto_applied,
            "cover_letter": app.cover_letter,
            "created_at": app.created_at,
            "updated_at": app.updated_at,
            "job": {
                "id": app.job.id,
                "title": app.job.title,
                "company": app.job.company,
                "location": app.job.location,
                "external_url": app.job.external_url
            } if app.job else None,
            "resume": {
                "id": app.resume.id,
                "filename": app.resume.filename
            } if app.resume else None
        }
        result.append(app_dict)
    
    return result


@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    app_data: ApplicationCreate,
    generate_cover_letter: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify job exists
    job = db.query(Job).filter(Job.id == app_data.job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Verify resume exists if provided
    resume = None
    if app_data.resume_id:
        resume = db.query(Resume).filter(
            Resume.id == app_data.resume_id,
            Resume.user_id == current_user.id
        ).first()
        if not resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
    else:
        # Use active resume
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True
        ).first()
    
    # Check if already applied
    existing = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.job_id == app_data.job_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already applied to this job"
        )
    
    # Create application
    application = Application(
        user_id=current_user.id,
        job_id=app_data.job_id,
        resume_id=resume.id if resume else None,
        status=ApplicationStatus.PENDING,
        notes=app_data.notes
    )
    
    db.add(application)
    db.commit()
    db.refresh(application)
    
    # Generate cover letter if requested
    if generate_cover_letter and resume:
        from app.services.application_service import generate_cover_letter
        cover_letter = generate_cover_letter(resume, job)
        application.cover_letter = cover_letter
        db.commit()
    
    return application


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
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
    
    return application


@router.put("/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: str,
    status_update: ApplicationStatusUpdate,
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
    
    application.status = status_update.status
    if status_update.notes:
        application.notes = status_update.notes
    
    application.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(application)
    
    return application


@router.put("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: str,
    app_data: ApplicationUpdate,
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
    
    # Update fields
    update_data = app_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)
    
    application.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(application)
    
    return application


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
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
    
    db.delete(application)
    db.commit()
    
    return None


@router.post("/{application_id}/apply")
async def submit_job_application(
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
    
    if application.status != ApplicationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot apply - current status is {application.status}"
        )
    
    # Submit the application
    try:
        result = submit_application(application)
        application.status = ApplicationStatus.APPLIED
        application.applied_date = datetime.utcnow()
        db.commit()
        
        return {"message": "Application submitted successfully", "result": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit application: {str(e)}"
        )


@router.get("/stats/summary")
async def get_application_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get application statistics for the current user"""
    stats = db.query(
        Application.status,
        func.count(Application.id).label("count")
    ).filter(
        Application.user_id == current_user.id
    ).group_by(Application.status).all()
    
    total = sum(s.count for s in stats)
    
    return {
        "total": total,
        "by_status": {s.status.value: s.count for s in stats},
        "pending": next((s.count for s in stats if s.status == ApplicationStatus.PENDING), 0),
        "applied": next((s.count for s in stats if s.status == ApplicationStatus.APPLIED), 0),
        "interview": next((s.count for s in stats if s.status == ApplicationStatus.INTERVIEW), 0),
        "offer": next((s.count for s in stats if s.status == ApplicationStatus.OFFER), 0),
        "rejected": next((s.count for s in stats if s.status == ApplicationStatus.REJECTED), 0)
    }
