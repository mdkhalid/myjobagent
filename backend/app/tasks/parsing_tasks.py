from celery import shared_task
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.resume import Resume
from app.services.parser_service import parse_resume_file


@shared_task(bind=True, max_retries=3)
def parse_resume_task(self, resume_id: str):
    """Parse resume and update database"""
    db = SessionLocal()
    
    try:
        # Get resume
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        
        if not resume:
            return {"error": "Resume not found"}
        
        # Parse resume
        parsed_data = parse_resume_file(resume.file_path)
        
        # Update resume
        resume.parsed_content = parsed_data["parsed_content"]
        resume.skills = parsed_data["skills"]
        resume.experience_years = parsed_data["experience_years"]
        resume.raw_text = parsed_data["raw_text"]
        
        db.commit()
        
        return {
            "success": True,
            "resume_id": resume_id,
            "skills_found": len(parsed_data["skills"]),
            "experience_years": parsed_data["experience_years"]
        }
    
    except Exception as exc:
        db.rollback()
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    
    finally:
        db.close()
