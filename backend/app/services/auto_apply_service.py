from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.application import Application, ApplicationStatus
from app.models.job import Job
from app.models.resume import Resume
from app.services.matching_service import calculate_match_score
from app.services.application_service import generate_cover_letter


class AutoApplyService:
    def __init__(self, user_id: str, resume_id: str):
        self.user_id = user_id
        self.resume_id = resume_id
        self.db = SessionLocal()
    
    def find_matching_jobs(
        self,
        min_match_score: float = 70.0,
        companies_exclude: List[str] = None,
        job_titles_target: List[str] = None,
        limit: int = 50
    ) -> List[dict]:
        """Find jobs that match the resume criteria"""
        companies_exclude = companies_exclude or []
        job_titles_target = job_titles_target or []
        
        # Get resume
        resume = self.db.query(Resume).filter(
            Resume.id == self.resume_id,
            Resume.user_id == self.user_id
        ).first()
        
        if not resume:
            return []
        
        # Get active jobs
        jobs_query = self.db.query(Job).filter(Job.is_active == True)
        
        # Exclude companies
        if companies_exclude:
            for company in companies_exclude:
                jobs_query = jobs_query.filter(~Job.company.ilike(f"%{company}%"))
        
        # Filter by job titles
        if job_titles_target:
            title_filters = []
            for title in job_titles_target:
                title_filters.append(Job.title.ilike(f"%{title}%"))
            if title_filters:
                from sqlalchemy import or_
                jobs_query = jobs_query.filter(or_(*title_filters))
        
        jobs = jobs_query.limit(limit).all()
        
        # Calculate match scores
        matching_jobs = []
        for job in jobs:
            match_result = calculate_match_score(resume, job)
            
            if match_result["score"] >= min_match_score:
                matching_jobs.append({
                    "job": job,
                    "match_score": match_result["score"],
                    "matching_skills": match_result["matching_skills"],
                    "missing_skills": match_result["missing_skills"]
                })
        
        # Sort by match score
        matching_jobs.sort(key=lambda x: x["match_score"], reverse=True)
        
        return matching_jobs
    
    def create_application(self, job: Job, match_score: float, auto_submit: bool = False) -> Optional[Application]:
        """Create an application for a job"""
        # Check if already applied
        existing = self.db.query(Application).filter(
            Application.user_id == self.user_id,
            Application.job_id == job.id
        ).first()
        
        if existing:
            return None
        
        # Generate cover letter
        resume = self.db.query(Resume).filter(Resume.id == self.resume_id).first()
        cover_letter = ""
        if resume:
            cover_letter = generate_cover_letter(resume, job)
        
        # Create application
        application = Application(
            user_id=self.user_id,
            job_id=job.id,
            resume_id=self.resume_id,
            status=ApplicationStatus.PENDING if not auto_submit else ApplicationStatus.APPLIED,
            match_score=match_score,
            auto_applied=auto_submit,
            cover_letter=cover_letter,
            applied_date=datetime.now(timezone.utc) if auto_submit else None
        )
        
        self.db.add(application)
        self.db.commit()
        self.db.refresh(application)
        
        return application
    
    def close(self):
        self.db.close()


def submit_application(application: Application) -> dict:
    """
    Submit an application to the job board.
    
    For now, this is a mock implementation. In production, this would:
    - Navigate to the job application page
    - Fill in the application form
    - Upload resume
    - Submit the application
    """
    # Mock submission
    result = {
        "success": True,
        "message": "Application submitted successfully (mock)",
        "application_id": str(application.id),
        "job_title": application.job.title if application.job else "Unknown",
        "company": application.job.company if application.job else "Unknown",
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    return result
