"""
Job Search Integration API Routes.

HTTP-based job search across multiple free APIs, with resume-driven
match scoring and auto-apply support.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.linkedin.orchestrator import LinkedInOrchestrator
from app.linkedin.models import (
    SearchRequest,
    ApplyToJobRequest,
    JobSearchResponse,
    ApplyResponse,
    MatchScore,
    JobWithMatch,
)
from app.linkedin.scraper import SOURCE_PRIORITY, SOURCE_LABELS
from app.models.job import Job
from app.models.resume import Resume
from app.models.user import User
from app.models.application import Application, ApplicationStatus
from app.core.security import get_current_user
from app.db.session import get_db
from app.services.matching_service import calculate_match_score

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Helper ───────────────────────────────────────────────────────────────────


def _load_resume(db: Session, resume_id: Optional[str], user_id) -> Optional[Resume]:
    """Load a resume by id, falling back to the user's active resume."""
    if resume_id:
        return db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == user_id,
        ).first()
    # Fallback: active resume
    return db.query(Resume).filter(
        Resume.user_id == user_id,
        Resume.is_active.is_(True),
    ).first()


def _prepare_search_terms(search_terms: List[str], resume: Optional[Resume]) -> List[str]:
    """If no explicit search terms, derive them from the resume's skills."""
    if search_terms and any(t.strip() for t in search_terms):
        return search_terms

    if resume and resume.skills:
        # Take top 8 skills as search keywords
        skills = resume.skills[:8]
        # Group them into meaningful search terms (2-3 skills each)
        terms = []
        for i in range(0, len(skills), 3):
            chunk = skills[i:i+3]
            terms.append(" ".join(chunk))
        if not terms:
            terms = [" ".join(skills[:3])]
        logger.info("Derived search terms from resume skills: %s", terms)
        return terms

    return search_terms


def _compute_resume_match(
    db: Session,
    job_dict: Dict[str, Any],
    resume: Optional[Resume],
) -> Optional[dict]:
    """Calculate match score between a job and the user's resume."""
    if not resume:
        return None

    # Build a minimal Job-like object for the matching service
    class _MiniJob:
        def __init__(self, data: Dict[str, Any]):
            self.title = data.get("title", "")
            self.company = data.get("company", "")
            self.location = data.get("location", "")
            self.skills_required = data.get("skills_required", [])
            self.requirements = data.get("requirements", [])
            self.description = data.get("description", "")

    mini_job = _MiniJob(job_dict)

    # We need a Resume object with attributes the matching service expects
    class _MiniResume:
        def __init__(self, resume: Resume):
            self.skills = resume.skills or []
            self.experience_years = resume.experience_years or 0
            self.parsed_content = resume.parsed_content or {}

    result = calculate_match_score(_MiniResume(resume), mini_job)
    return result


# ─── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/search", response_model=JobSearchResponse)
async def search_jobs(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search jobs across free HTTP APIs, optionally using resume for scoring."""
    orch = LinkedInOrchestrator()

    try:
        # Load resume if requested
        resume = _load_resume(db, request.resume_id, current_user.id)

        # Derive search terms from resume if none provided
        terms = _prepare_search_terms(request.search.search_terms, resume)
        if not terms or not any(t.strip() for t in terms):
            raise HTTPException(status_code=400, detail="No search terms provided and no resume skills available")

        # Assemble config
        cfg = {
            "max_jobs": request.search.max_jobs,
            "filters": request.search.filters.model_dump(),
            "personal_info": request.apply_config.personal_info.model_dump(),
            "application_questions": request.apply_config.application_questions.model_dump(),
            "resume_path": request.apply_config.resume_path,
            "sources": request.search.sources,
        }
        orch.configure(cfg)

        keywords = " ".join(terms)
        jobs = orch.search_jobs(keywords=keywords, location=request.search.location)

        # Persist to DB
        orch.save_jobs_to_db(jobs)

        # Enrich with DB IDs and match scores
        enriched: List[JobWithMatch] = []
        for jd in jobs:
            db_job = db.query(Job).filter(
                Job.external_id == jd.get("external_id")
            ).first()

            # Calculate match score against resume
            score = _compute_resume_match(db, jd, resume)

            enriched.append(JobWithMatch(
                id=str(db_job.id) if db_job else None,
                title=jd.get("title", ""),
                company=jd.get("company", ""),
                location=jd.get("location", ""),
                description=jd.get("description", ""),
                job_link=jd.get("job_link", ""),
                external_id=jd.get("external_id", ""),
                source=jd.get("source", ""),
                easy_apply=jd.get("easy_apply", False),
                posted_date=jd.get("posted_date"),
                is_active=jd.get("is_active", True),
                salary_min=jd.get("salary_min"),
                salary_max=jd.get("salary_max"),
                salary_currency=jd.get("salary_currency", "USD"),
                job_type=jd.get("job_type", ""),
                skills_required=jd.get("skills_required", []),
                match_score=MatchScore(**score) if score else None,
            ))

        # Sort by match score descending if resume was used
        if resume:
            enriched.sort(
                key=lambda j: (j.match_score.score if j.match_score else 0),
                reverse=True,
            )

        sources_used = list(set(
            j.get("source", "unknown") for j in jobs
        ))

        resume_note = f" — scored against your resume" if resume else ""
        return JobSearchResponse(
            jobs=enriched,
            total_count=len(enriched),
            message=f"Found {len(enriched)} jobs from {len(sources_used)} sources{resume_note}",
            sources_used=sources_used,
            resume_used=str(resume.id) if resume else None,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Job search error")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/apply", response_model=ApplyResponse)
async def apply_to_jobs(
    request: ApplyToJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create application records for selected jobs.

    If a resume_id is provided (or an active resume exists), the application
    will include a cover letter generated from the resume and the resume
    will be linked to the application for tracking purposes.
    """
    if not request.job_ids:
        raise HTTPException(status_code=400, detail="No job IDs provided")

    # Load resume if available
    resume = _load_resume(db, request.resume_id, current_user.id)
    from app.services.application_service import generate_cover_letter

    success_count = 0
    failed_jobs: List[Dict[str, str]] = []
    applications_created: List[Dict[str, Any]] = []

    for jid in request.job_ids:
        try:
            # Resolve job from DB (try external_id first, then UUID)
            job = (
                db.query(Job).filter(Job.external_id == jid).first()
                or _query_by_uuid(db, jid)
            )
            if not job:
                failed_jobs.append({
                    "title": jid,
                    "company": "",
                    "reason": "Job not found in database. Run a search first.",
                })
                continue

            # Check if already applied
            existing = db.query(Application).filter(
                Application.user_id == current_user.id,
                Application.job_id == job.id,
            ).first()
            if existing:
                failed_jobs.append({
                    "title": job.title,
                    "company": job.company,
                    "reason": "Already applied to this job",
                })
                continue

            # Generate cover letter if resume is available
            cover_letter = ""
            if resume:
                try:
                    cover_letter = generate_cover_letter(resume, job)
                except Exception:
                    cover_letter = ""

            # Calculate match score
            match_score = None
            if resume:
                try:
                    from app.services.matching_service import calculate_match_score as calc_score
                    result = calc_score(resume, job)
                    match_score = result.get("score")
                except Exception:
                    pass

            # Create application record
            application = Application(
                user_id=current_user.id,
                job_id=job.id,
                resume_id=resume.id if resume else None,
                status=ApplicationStatus.APPLIED,
                match_score=match_score,
                auto_applied=True,
                cover_letter=cover_letter,
                notes=f"Auto-applied via job search{' with resume' if resume else ''}",
                applied_date=datetime.now(timezone.utc),
            )
            db.add(application)
            db.commit()
            db.refresh(application)

            applications_created.append({
                "id": str(application.id),
                "job_title": job.title,
                "company": job.company,
                "cover_letter_generated": bool(cover_letter),
                "match_score": match_score,
            })
            success_count += 1

        except Exception as exc:
            logger.error("Error applying to job %s: %s", jid, exc)
            failed_jobs.append({
                "title": jid,
                "company": "",
                "reason": str(exc),
            })

    return ApplyResponse(
        success_count=success_count,
        failed_jobs=failed_jobs,
        applications_created=applications_created,
        message=f"Applied to {success_count} jobs, {len(failed_jobs)} failed"
                f"{' with resume-driven cover letters' if resume and success_count > 0 else ''}",
    )


@router.get("/jobs")
async def get_saved_jobs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    source: str = Query("", description="Filter by job source (e.g. remoteok, remotive)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get saved jobs from the database."""
    offset = (page - 1) * size
    query = db.query(Job).filter(Job.is_active.is_(True))

    if source:
        query = query.filter(Job.source == source)

    total = query.count()
    jobs = query.offset(offset).limit(size).all()

    return {
        "jobs": [
            {
                "id": str(j.id),
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "external_url": j.external_url,
                "external_id": j.external_id,
                "source": j.source,
                "job_type": j.job_type.value if j.job_type else None,
                "posted_date": j.posted_date.isoformat() if j.posted_date else None,
                "salary_min": float(j.salary_min) if j.salary_min else None,
                "salary_max": float(j.salary_max) if j.salary_max else None,
                "is_active": j.is_active,
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if total else 0,
    }


@router.get("/sources")
async def list_available_sources():
    """List available job board data sources."""
    return {
        "sources": [
            {
                "id": sid,
                "label": SOURCE_LABELS.get(sid, sid),
                "requires_api_key": sid in ("jooble", "findwork", "adzuna", "usajobs"),
                "free_no_key": sid in ("remoteok", "remotive", "jobicy", "arbeitnow"),
            }
            for sid in SOURCE_PRIORITY
        ]
    }


def _query_by_uuid(db: Session, raw: str):
    try:
        return db.query(Job).filter(Job.id == UUID(raw)).first()
    except (ValueError, TypeError):
        return None
