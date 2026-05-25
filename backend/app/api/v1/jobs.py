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
from app.services.scraper_service import scrape_jobs, save_jobs_to_db
from app.services.matching_service import calculate_match_score

router = APIRouter()


@router.get("/")
async def get_jobs(
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    keywords: Optional[str] = None,
    location: Optional[str] = None,
    job_type: Optional[JobType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Job).filter(Job.is_active == True, Job.source != 'mock')
    
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
    
    total = query.count()
    offset = (page - 1) * limit
    jobs = query.order_by(Job.posted_date.desc().nullslast()).offset(offset).limit(limit).all()
    
    return {
        "items": jobs,
        "total": total,
        "page": page,
        "page_size": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0
    }


@router.get("/search")
async def search_jobs(
    params: JobSearchParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Job).filter(Job.is_active == True, Job.source != 'mock')
    
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
    jobs = query.order_by(Job.posted_date.desc().nullslast()).offset((params.page - 1) * params.page_size).limit(params.page_size).all()
    
    return {
        "items": jobs,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": (total + params.page_size - 1) // params.page_size if total > 0 else 0
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
    limit: int = Query(50, ge=1, le=200),
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
    
    # Get all active jobs (exclude mock data)
    jobs = db.query(Job).filter(Job.is_active == True, Job.source != 'mock').all()
    
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
    keywords: str = "software",
    location: Optional[str] = "remote",
    source: Optional[str] = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Scrape jobs synchronously and save to database"""
    try:
        jobs_data = scrape_jobs(keywords, location, source)
        saved_count = save_jobs_to_db(jobs_data)
        return {
            "message": f"Found {len(jobs_data)} jobs, saved {saved_count} new ones",
            "keywords": keywords,
            "location": location,
            "total_found": len(jobs_data),
            "saved": saved_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Job scraping failed: {str(e)}"
        )


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = Job(**job_data.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
