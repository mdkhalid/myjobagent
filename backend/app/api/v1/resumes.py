import os
import uuid
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.schemas.resume import ResumeCreate, ResumeResponse, ResumeUpdate, ParsedResume
from app.config import settings
from app.services.parser_service import parse_resume_file
from app.tasks.parsing_tasks import parse_resume_task

router = APIRouter()


def save_upload_file(upload_file: UploadFile, user_id: str) -> str:
    """Save uploaded file and return file path"""
    # Create user-specific upload directory
    user_upload_dir = os.path.join(settings.UPLOAD_DIR, str(user_id))
    os.makedirs(user_upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_extension = os.path.splitext(upload_file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(user_upload_dir, unique_filename)
    
    # Save file
    with open(file_path, "wb") as f:
        content = upload_file.file.read()
        f.write(content)
    
    return file_path


@router.get("/", response_model=List[ResumeResponse])
async def get_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    resumes = db.query(Resume).filter(Resume.user_id == current_user.id).all()
    return resumes


@router.post("/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate file type
    allowed_extensions = {".pdf", ".docx", ".doc"}
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Save file
    try:
        file_path = save_upload_file(file, str(current_user.id))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Create resume record
    resume = Resume(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        parsed_content={},
        skills=[],
        experience_years=0,
        raw_text=""
    )
    
    db.add(resume)
    db.commit()
    db.refresh(resume)
    
    # Parse resume immediately (don't rely on Celery)
    try:
        parsed_data = parse_resume_file(file_path)
        resume.parsed_content = parsed_data["parsed_content"]
        resume.skills = parsed_data["skills"]
        resume.experience_years = parsed_data["experience_years"]
        resume.raw_text = parsed_data["raw_text"]
        db.commit()
        db.refresh(resume)
    except Exception as e:
        # Parsing failed but resume is saved
        print(f"Resume parsing failed: {e}")
    
    return resume


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    return resume


@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: str,
    resume_data: ResumeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    # Update fields
    update_data = resume_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(resume, field, value)
    
    resume.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(resume)
    
    return resume


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    # Delete file
    try:
        if os.path.exists(resume.file_path):
            os.remove(resume.file_path)
    except Exception:
        pass
    
    db.delete(resume)
    db.commit()
    
    return None


@router.post("/{resume_id}/parse", response_model=ResumeResponse)
async def trigger_parse_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    # Trigger parsing task (skip if broker not available)
    try:
        parse_resume_task.delay(str(resume.id))
    except Exception:
        pass
    
    return resume


@router.get("/{resume_id}/parsed", response_model=ParsedResume)
async def get_parsed_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    return ParsedResume(
        parsed_content=resume.parsed_content,
        skills=resume.skills,
        experience_years=resume.experience_years,
        raw_text=resume.raw_text
    )


@router.post("/{resume_id}/set-active", response_model=ResumeResponse)
async def set_active_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # First, deactivate all user's resumes
    db.query(Resume).filter(
        Resume.user_id == current_user.id
    ).update({"is_active": False})
    
    # Activate the selected resume
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    resume.is_active = True
    db.commit()
    db.refresh(resume)
    
    return resume
