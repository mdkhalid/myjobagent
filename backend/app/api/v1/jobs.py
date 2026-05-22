from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.job import Job, JobType
from app.models.resume import Resume
from app.schemas.job import JobCreate, JobResponse, JobSearchParams, JobMatchResult
from app.services.scraper_service import scrape_jobs
from app.services.matching_service import calculate_match_score
from app.tasks.scraping_tasks import scrape_jobs_task

router = APIRouter()


@router.get("/", response_model=List[JobResponse])
async def get_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keywords: Optional[str] = None,
    location: Optional[str] = None,
    job_type: Optional[JobType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Job).filter(Job.is_active == True)
    
    if keywords:
        query = query.filter(
            func.lower(Job.title).contains(func.lower(keywords)) |
            func.lower(Job.company).contains(func.lower(keywords)) |
            func.lower(Job.description).contains(func.lower(keywords))
        )
    
    if location:
        query = query.filter(func.lower(Job.location).contains(func.lower(location)))
    
    if job_type:
        query = query.filter(Job.job_type == job_type)
    
    jobs = query.offset(skip).limit(limit).all()
    return jobs


@router.get("/search")
async def search_jobs(
    params: JobSearchParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Job).filter(Job.is_active == True)
    
    if params.keywords:
        query = query.filter(
            func.lower(Job.title).contains(func.lower(params.keywords)) |
            func.lower(Job.company).contains(func.lower(params.keywords)) |
            func.lower(Job.description).contains(func.lower(params.keywords))
        )
    
    if params.location:
        query = query.filter(func.lower(Job.location).contains(func.lower(params.location)))
    
    if params.job_type:
        query = query.filter(Job.job_type == params.job_type)
    
    if params.skills:
        for skill in params.skills:
            query = query.filter(Job.skills_required.contains([skill]))
    
    if params.min_salary:
        query = query.filter(Job.salary_max >= params.min_salary)
    
    if params.max_salary:
        query = query.filter(Job.salary_min <= params.max_salary)
    
    total = query.count()
    jobs = query.offset((params.page - 1) * params.page_size).limit(params.page_size).all()
    
    return {
        "items": jobs,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": (total + params.page_size - 1) // params.page_size
    }


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return job


@router.post("/match")
async def match_jobs(
    resume_id: Optional[str] = None,
    min_score: float = Query(0.0, ge=0.0, le=100.0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get the resume to match against
    if resume_id:
        resume = db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == current_user.id
        ).first()
    else:
        # Use active resume
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True
        ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload a resume first."
        )
    
    # Get all active jobs
    jobs = db.query(Job).filter(Job.is_active == True).all()
    
    # Calculate match scores
    matched_jobs = []
    for job in jobs:
        match_result = calculate_match_score(resume, job)
        if match_result["score"] >= min_score:
            matched_jobs.append({
                "job": job,
                "match_score": match_result["score"],
                "matching_skills": match_result["matching_skills"],
                "missing_skills": match_result["missing_skills"]
            })
    
    # Sort by match score
    matched_jobs.sort(key=lambda x: x["match_score"], reverse=True)
    
    # Return top matches
    return matched_jobs[:limit]


@router.post("/scrape")
async def trigger_scrape(
    keywords: str,
    location: Optional[str] = None,
    source: Optional[str] = "all",
    current_user: User = Depends(get_current_user)
):
    # Trigger scraping task (skip if broker not available)
    try:
        scrape_jobs_task.delay(keywords, location, source)
        return {"message": "Job scraping started", "keywords": keywords, "location": location}
    except Exception:
        return {"message": "Job scraping unavailable (broker not running)", "keywords": keywords, "location": location}


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = Job(**job_data.dict())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
