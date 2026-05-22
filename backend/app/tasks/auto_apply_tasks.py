from celery import shared_task
from typing import List, Optional

from app.services.auto_apply_service import AutoApplyService, submit_application
from app.db.session import SessionLocal
from app.models.application import Application, ApplicationStatus


@shared_task(bind=True, max_retries=3)
def auto_apply_task(
    self,
    user_id: str,
    resume_id: str,
    min_match_score: float = 70.0,
    daily_limit: int = 10,
    companies_exclude: Optional[List[str]] = None,
    job_titles_target: Optional[List[str]] = None,
    auto_submit: bool = False
):
    """Auto-apply to matching jobs"""
    service = AutoApplyService(user_id, resume_id)
    
    try:
        # Find matching jobs
        matching_jobs = service.find_matching_jobs(
            min_match_score=min_match_score,
            companies_exclude=companies_exclude or [],
            job_titles_target=job_titles_target or [],
            limit=daily_limit * 2  # Get more than limit to account for already applied
        )
        
        applications_created = 0
        applications_submitted = 0
        
        for match in matching_jobs:
            if applications_created >= daily_limit:
                break
            
            job = match["job"]
            match_score = match["match_score"]
            
            # Create application
            application = service.create_application(job, match_score, auto_submit)
            
            if application:
                applications_created += 1
                
                # Submit if auto_submit is enabled
                if auto_submit:
                    try:
                        submit_application(application)
                        application.status = ApplicationStatus.APPLIED
                        applications_submitted += 1
                    except Exception as e:
                        print(f"Failed to submit application: {e}")
        
        return {
            "success": True,
            "user_id": user_id,
            "jobs_matched": len(matching_jobs),
            "applications_created": applications_created,
            "applications_submitted": applications_submitted,
            "auto_submit": auto_submit
        }
    
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300 * (2 ** self.request.retries))
    
    finally:
        service.close()


@shared_task
def submit_pending_applications():
    """Submit all pending applications that are approved"""
    db = SessionLocal()
    
    try:
        # Get pending applications
        pending = db.query(Application).filter(
            Application.status == ApplicationStatus.PENDING
        ).all()
        
        submitted = 0
        failed = 0
        
        for application in pending:
            try:
                result = submit_application(application)
                if result.get("success"):
                    application.status = ApplicationStatus.APPLIED
                    submitted += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"Failed to submit application {application.id}: {e}")
                failed += 1
        
        db.commit()
        
        return {
            "success": True,
            "pending_count": len(pending),
            "submitted": submitted,
            "failed": failed
        }
    
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    
    finally:
        db.close()
