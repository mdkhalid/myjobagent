from typing import Optional
from app.models.resume import Resume
from app.models.job import Job
from app.config import settings


def generate_cover_letter(resume: Resume, job: Job) -> str:
    """Generate a tailored cover letter using AI or templates"""
    
    # Get candidate info
    candidate_name = resume.parsed_content.get("full_name", "") if resume.parsed_content else ""
    skills = resume.skills or []
    experience_years = resume.experience_years or 0
    
    # Get job info
    company = job.company
    position = job.title
    
    # Generate cover letter
    cover_letter = f"""Dear Hiring Manager,

I am writing to express my strong interest in the {position} position at {company}. With {experience_years} years of experience in software development and expertise in {', '.join(skills[:5])}, I am confident in my ability to contribute effectively to your team.

Throughout my career, I have developed a strong foundation in:
{chr(10).join(f'- {skill}' for skill in skills[:8])}

I am particularly drawn to {company} because of its reputation for innovation and its commitment to delivering exceptional products. The opportunity to work on challenging projects while collaborating with talented professionals excites me.

I would welcome the opportunity to discuss how my background and skills align with your needs. Thank you for considering my application.

Sincerely,
{candidate_name}
"""
    
    return cover_letter


def create_application_with_cover_letter(resume: Resume, job: Job, notes: Optional[str] = None) -> dict:
    """Create application data with cover letter"""
    cover_letter = generate_cover_letter(resume, job)
    
    return {
        "job_id": job.id,
        "resume_id": resume.id,
        "cover_letter": cover_letter,
        "notes": notes or ""
    }
