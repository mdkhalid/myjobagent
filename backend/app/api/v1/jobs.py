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
from app.services.matching_service import calculate_match_score, expand_skill_synonyms
from collections import Counter

router = APIRouter()


# ── Learning resource suggestions for common skills ────────────────

SKILL_LEARNING_RESOURCES = {
    "python": [
        {"name": "Python for Everybody (Coursera)", "url": "https://www.coursera.org/specializations/python", "platform": "Coursera"},
        {"name": "Automate the Boring Stuff", "url": "https://automatetheboringstuff.com/", "platform": "Free"},
    ],
    "javascript": [
        {"name": "JavaScript: The Good Parts (O'Reilly)", "url": "https://www.oreilly.com/library/view/javascript-the-good/9780596517748/", "platform": "Book"},
        {"name": "freeCodeCamp JavaScript", "url": "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/", "platform": "Free"},
    ],
    "typescript": [
        {"name": "TypeScript Handbook", "url": "https://www.typescriptlang.org/docs/handbook/", "platform": "Free"},
        {"name": "Understanding TypeScript (Udemy)", "url": "https://www.udemy.com/course/understanding-typescript/", "platform": "Udemy"},
    ],
    "react": [
        {"name": "React Official Tutorial", "url": "https://react.dev/learn", "platform": "Free"},
        {"name": "Epic React (Kent C. Dodds)", "url": "https://epicreact.dev/", "platform": "Paid"},
    ],
    "angular": [
        {"name": "Angular Official Docs", "url": "https://angular.dev/tutorials", "platform": "Free"},
        {"name": "Angular The Complete Guide (Udemy)", "url": "https://www.udemy.com/course/the-complete-guide-to-angular-2/", "platform": "Udemy"},
    ],
    "node.js": [
        {"name": "Node.js Official Docs", "url": "https://nodejs.org/en/docs/", "platform": "Free"},
        {"name": "The Complete Node.js Course", "url": "https://www.udemy.com/course/nodejs-the-complete-guide/", "platform": "Udemy"},
    ],
    "docker": [
        {"name": "Docker Quick Start", "url": "https://docs.docker.com/get-started/", "platform": "Free"},
        {"name": "Docker Mastery (Udemy)", "url": "https://www.udemy.com/course/docker-mastery/", "platform": "Udemy"},
    ],
    "kubernetes": [
        {"name": "Kubernetes Basics", "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/", "platform": "Free"},
        {"name": "CKAD Path (Udemy)", "url": "https://www.udemy.com/course/certified-kubernetes-application-developer/", "platform": "Udemy"},
    ],
    "aws": [
        {"name": "AWS Free Digital Training", "url": "https://aws.amazon.com/training/digital/", "platform": "Free"},
        {"name": "A Cloud Guru", "url": "https://acloudguru.com/", "platform": "Paid"},
    ],
    "sql": [
        {"name": "SQL Tutorial (W3Schools)", "url": "https://www.w3schools.com/sql/", "platform": "Free"},
        {"name": "SQL for Data Science (Coursera)", "url": "https://www.coursera.org/learn/sql-for-data-science", "platform": "Coursera"},
    ],
    "git": [
        {"name": "GitHub Skills", "url": "https://skills.github.com/", "platform": "Free"},
        {"name": "Pro Git Book", "url": "https://git-scm.com/book/en/v2", "platform": "Free"},
    ],
    "machine learning": [
        {"name": "Machine Learning Specialization (Coursera)", "url": "https://www.coursera.org/specializations/machine-learning-introduction", "platform": "Coursera"},
        {"name": "fast.ai Practical Deep Learning", "url": "https://course.fast.ai/", "platform": "Free"},
    ],
    "java": [
        {"name": "Java Programming (Coursera)", "url": "https://www.coursera.org/specializations/java-programming", "platform": "Coursera"},
        {"name": "Java Tutorials (Oracle)", "url": "https://docs.oracle.com/javase/tutorial/", "platform": "Free"},
    ],
    "c++": [
        {"name": "C++ for Programmers (Udacity)", "url": "https://www.udacity.com/course/c-for-programmers--ud210", "platform": "Free"},
        {"name": "LearnCpp.com", "url": "https://www.learncpp.com/", "platform": "Free"},
    ],
    "go": [
        {"name": "Go by Example", "url": "https://gobyexample.com/", "platform": "Free"},
        {"name": "Go Tour", "url": "https://go.dev/tour/", "platform": "Free"},
    ],
    "graphql": [
        {"name": "How to GraphQL", "url": "https://www.howtographql.com/", "platform": "Free"},
        {"name": "GraphQL Official Docs", "url": "https://graphql.org/learn/", "platform": "Free"},
    ],
    "redis": [
        {"name": "Redis University", "url": "https://university.redis.com/", "platform": "Free"},
        {"name": "Redis in Action", "url": "https://redis.com/ebook/redis-in-action/", "platform": "Free"},
    ],
    "mongodb": [
        {"name": "MongoDB University", "url": "https://university.mongodb.com/", "platform": "Free"},
        {"name": "MongoDB Docs", "url": "https://www.mongodb.com/docs/", "platform": "Free"},
    ],
    "tensorflow": [
        {"name": "TensorFlow Tutorials", "url": "https://www.tensorflow.org/tutorials", "platform": "Free"},
        {"name": "DeepLearning.AI TensorFlow Specialization", "url": "https://www.coursera.org/specializations/tensorflow-in-practice", "platform": "Coursera"},
    ],
    "django": [
        {"name": "Django Official Docs", "url": "https://docs.djangoproject.com/", "platform": "Free"},
        {"name": "Django for Everybody (Coursera)", "url": "https://www.coursera.org/specializations/django", "platform": "Coursera"},
    ],
    "flask": [
        {"name": "Flask Mega-Tutorial", "url": "https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world", "platform": "Free"},
        {"name": "Flask Official Docs", "url": "https://flask.palletsprojects.com/", "platform": "Free"},
    ],
    "fastapi": [
        {"name": "FastAPI Official Docs", "url": "https://fastapi.tiangolo.com/learn/", "platform": "Free"},
        {"name": "FastAPI Course (TalkPython)", "url": "https://training.talkpython.fm/fastapi-course", "platform": "Paid"},
    ],
    "postgresql": [
        {"name": "PostgreSQL Tutorial", "url": "https://www.postgresqltutorial.com/", "platform": "Free"},
        {"name": "PostgreSQL Docs", "url": "https://www.postgresql.org/docs/", "platform": "Free"},
    ],
    "css": [
        {"name": "CSS Tutorial (MDN)", "url": "https://developer.mozilla.org/en-US/docs/Web/CSS", "platform": "Free"},
        {"name": "CSS for JS Developers", "url": "https://css-for-js.dev/", "platform": "Paid"},
    ],
    "html": [
        {"name": "HTML Tutorial (MDN)", "url": "https://developer.mozilla.org/en-US/docs/Web/HTML", "platform": "Free"},
        {"name": "freeCodeCamp HTML/CSS", "url": "https://www.freecodecamp.org/learn/responsive-web-design/", "platform": "Free"},
    ],
    "linux": [
        {"name": "Linux Journey", "url": "https://linuxjourney.com/", "platform": "Free"},
        {"name": "Linux Foundation Training", "url": "https://training.linuxfoundation.org/", "platform": "Paid"},
    ],
    "rest api": [
        {"name": "REST API Tutorial", "url": "https://restfulapi.net/", "platform": "Free"},
        {"name": "Build APIs (Udemy)", "url": "https://www.udemy.com/course/rest-api-design/", "platform": "Udemy"},
    ],
    "ci/cd": [
        {"name": "GitHub Actions Docs", "url": "https://docs.github.com/en/actions", "platform": "Free"},
        {"name": "CI/CD Pipeline (Coursera)", "url": "https://www.coursera.org/learn/ci-cd", "platform": "Coursera"},
    ],
    "terraform": [
        {"name": "Terraform Tutorials", "url": "https://developer.hashicorp.com/terraform/tutorials", "platform": "Free"},
        {"name": "Terraform Up & Running", "url": "https://www.terraformupandrunning.com/", "platform": "Book"},
    ],
    "rust": [
        {"name": "Rust Book", "url": "https://doc.rust-lang.org/book/", "platform": "Free"},
        {"name": "Rustlings", "url": "https://github.com/rust-lang/rustlings", "platform": "Free"},
    ],
}


def _get_learning_resources(skill: str) -> list:
    skill_lower = skill.lower().strip()
    if skill_lower in SKILL_LEARNING_RESOURCES:
        return SKILL_LEARNING_RESOURCES[skill_lower]
    expanded = expand_skill_synonyms(skill_lower)
    for key in SKILL_LEARNING_RESOURCES:
        if key in expanded:
            return SKILL_LEARNING_RESOURCES[key]
    return []


# ── Routes (static paths before param paths) ───────────────────────


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


@router.get("/skill-gap")
async def get_skill_gap_analysis(
    resume_id: Optional[str] = Query(None),
    min_score: float = Query(0.0, ge=0.0, le=100.0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze skill gaps across all matched jobs."""
    # Get the resume
    if resume_id:
        resume = db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == current_user.id
        ).first()
    else:
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True
        ).first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload a resume first."
        )

    jobs = db.query(Job).filter(Job.is_active == True, Job.source != 'mock').all()

    if not jobs:
        return {
            "my_skills": resume.skills or [],
            "skill_match_percentage": 100.0,
            "analyzed_jobs": 0,
            "missing_skills": [],
            "job_breakdown": []
        }

    job_breakdown = []
    missing_skills_counter = Counter()

    for job in jobs:
        match_result = calculate_match_score(resume, job)
        if match_result["score"] >= min_score:
            job_breakdown.append({
                "job_id": str(job.id),
                "job_title": job.title,
                "company": job.company,
                "match_score": match_result["score"],
                "matching_skills": match_result["matching_skills"],
                "missing_skills": match_result["missing_skills"],
            })
            for skill in match_result["missing_skills"]:
                missing_skills_counter[skill] += 1

    total_analyzed = len(job_breakdown) or 1
    all_skills_for_jobs = set()
    for jb in job_breakdown:
        for s in jb["matching_skills"]:
            all_skills_for_jobs.add(s)
        for s in jb["missing_skills"]:
            all_skills_for_jobs.add(s)

    total_required = len(all_skills_for_jobs) or 1
    resume_skill_set = set(s.lower() for s in (resume.skills or []))
    matched_count = sum(1 for s in all_skills_for_jobs if s.lower() in resume_skill_set)
    skill_match_pct = round((matched_count / total_required) * 100, 2)

    missing_skills_agg = []
    for skill, freq in missing_skills_counter.most_common():
        missing_skills_agg.append({
            "skill": skill,
            "frequency": freq,
            "in_percent_of_jobs": round((freq / total_analyzed) * 100, 1),
            "learning_resources": _get_learning_resources(skill),
        })

    return {
        "my_skills": resume.skills or [],
        "skill_match_percentage": skill_match_pct,
        "analyzed_jobs": len(job_breakdown),
        "total_skills_required": len(all_skills_for_jobs),
        "skills_i_have": sorted(all_skills_for_jobs & resume_skill_set),
        "missing_skills": missing_skills_agg,
        "job_breakdown": job_breakdown[:limit],
    }


@router.get("/{job_id}/skill-gap")
async def get_job_skill_gap(
    job_id: str,
    resume_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze skill gap for a single job against the user's resume."""
    # Get the job
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    # Get the resume
    if resume_id:
        resume = db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == current_user.id
        ).first()
    else:
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True
        ).first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload a resume first."
        )

    match_result = calculate_match_score(resume, job)

    missing_skills_with_resources = []
    for skill in match_result["missing_skills"]:
        missing_skills_with_resources.append({
            "skill": skill,
            "learning_resources": _get_learning_resources(skill),
        })

    return {
        "job_id": str(job.id),
        "job_title": job.title,
        "company": job.company,
        "match_score": match_result["score"],
        "my_skills": resume.skills or [],
        "matching_skills": match_result["matching_skills"],
        "missing_skills": missing_skills_with_resources,
        "score_breakdown": {
            "skill_score": match_result["skill_score"],
            "title_score": match_result["title_score"],
            "experience_score": match_result["experience_score"],
            "location_score": match_result["location_score"],
        },
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
    if resume_id:
        resume = db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == current_user.id
        ).first()
    else:
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True
        ).first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload a resume first."
        )

    jobs = db.query(Job).filter(Job.is_active == True, Job.source != 'mock').all()

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

    matched_jobs.sort(key=lambda x: x["match_score"], reverse=True)
    return matched_jobs[:limit]


@router.post("/scrape")
async def trigger_scrape(
    keywords: str = "software",
    location: Optional[str] = "remote",
    source: Optional[str] = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
