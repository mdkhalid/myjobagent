from typing import List, Dict, Set
from difflib import SequenceMatcher

from app.models.resume import Resume
from app.models.job import Job


def normalize_skill(skill: str) -> str:
    """Normalize skill name for comparison"""
    return skill.lower().strip().replace(".", "").replace(" ", "")


def calculate_skill_match(resume_skills: List[str], job_skills: List[str]) -> Dict:
    """Calculate skill match between resume and job"""
    if not job_skills:
        return {
            "match_percentage": 100.0,
            "matching_skills": [],
            "missing_skills": []
        }
    
    # Normalize skills
    normalized_resume_skills = {normalize_skill(s) for s in resume_skills}
    normalized_job_skills = {normalize_skill(s) for s in job_skills}
    
    # Find matches using fuzzy matching
    matching_skills = []
    missing_skills = []
    
    for job_skill in job_skills:
        normalized_job = normalize_skill(job_skill)
        matched = False
        
        # Exact match
        if normalized_job in normalized_resume_skills:
            matching_skills.append(job_skill)
            matched = True
        else:
            # Fuzzy match
            for resume_skill in resume_skills:
                normalized_resume = normalize_skill(resume_skill)
                similarity = SequenceMatcher(None, normalized_job, normalized_resume).ratio()
                if similarity > 0.8:  # 80% similarity threshold
                    matching_skills.append(job_skill)
                    matched = True
                    break
        
        if not matched:
            missing_skills.append(job_skill)
    
    match_percentage = (len(matching_skills) / len(job_skills)) * 100 if job_skills else 100
    
    return {
        "match_percentage": round(match_percentage, 2),
        "matching_skills": matching_skills,
        "missing_skills": missing_skills
    }


def calculate_title_match(resume_title: str, job_title: str) -> float:
    """Calculate title similarity"""
    if not resume_title or not job_title:
        return 50.0  # Neutral score if missing
    
    # Normalize titles
    resume_words = set(resume_title.lower().split())
    job_words = set(job_title.lower().split())
    
    # Common job title keywords
    tech_keywords = {
        "engineer", "developer", "architect", "manager", "lead", "senior", "junior",
        "frontend", "backend", "fullstack", "full-stack", "devops", "data", "machine",
        "learning", "software", "web", "mobile", "cloud", "security"
    }
    
    # Count matching keywords
    resume_tech = resume_words & tech_keywords
    job_tech = job_words & tech_keywords
    
    if not job_tech:
        return 50.0
    
    matching = len(resume_tech & job_tech)
    match_score = (matching / len(job_tech)) * 100
    
    return round(match_score, 2)


def calculate_experience_match(resume_years: int, job_requirements: List[str]) -> float:
    """Calculate experience match"""
    # Try to extract years requirement from job description
    required_years = None
    
    import re
    for req in job_requirements:
        # Look for patterns like "3+ years", "5 years of experience"
        patterns = [
            r'(\d+)\+?\s*years?\s*of\s*experience',
            r'(\d+)\+?\s*years?\s*experience',
            r'(\d+)\+?\s*years?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, req.lower())
            if match:
                required_years = int(match.group(1))
                break
        
        if required_years:
            break
    
    if not required_years:
        return 100.0  # No explicit requirement
    
    if resume_years >= required_years:
        return 100.0
    elif resume_years >= required_years * 0.8:
        return 80.0
    elif resume_years >= required_years * 0.5:
        return 50.0
    else:
        return max(10.0, (resume_years / required_years) * 100)


def calculate_location_match(resume_location: str, job_location: str) -> float:
    """Calculate location match score"""
    if not job_location:
        return 100.0
    
    if not resume_location:
        return 50.0  # Unknown location
    
    # Normalize
    resume_loc = resume_location.lower().strip()
    job_loc = job_location.lower().strip()
    
    # Exact match
    if resume_loc == job_loc:
        return 100.0
    
    # Partial match
    if resume_loc in job_loc or job_loc in resume_loc:
        return 80.0
    
    # Remote jobs
    if "remote" in job_loc:
        return 100.0
    
    # Same state/region (simplified)
    # This is a basic implementation - could be enhanced with geocoding
    return 30.0


def calculate_match_score(resume: Resume, job: Job) -> Dict:
    """Calculate overall match score between resume and job"""
    
    # Skill match (40% weight)
    skill_result = calculate_skill_match(
        resume.skills or [],
        job.skills_required or []
    )
    skill_score = skill_result["match_percentage"]
    
    # Title match (20% weight)
    resume_title = resume.parsed_content.get("experience", [{}])[0].get("title", "") if resume.parsed_content else ""
    title_score = calculate_title_match(resume_title, job.title)
    
    # Experience match (20% weight)
    exp_score = calculate_experience_match(
        resume.experience_years or 0,
        job.requirements or []
    )
    
    # Location match (10% weight)
    resume_location = resume.parsed_content.get("location", "") if resume.parsed_content else ""
    location_score = calculate_location_match(resume_location, job.location)
    
    # Job type bonus (10% weight)
    job_type_score = 100.0  # Default
    # Could adjust based on user preferences
    
    # Calculate weighted score
    weighted_score = (
        skill_score * 0.40 +
        title_score * 0.20 +
        exp_score * 0.20 +
        location_score * 0.10 +
        job_type_score * 0.10
    )
    
    return {
        "score": round(weighted_score, 2),
        "skill_score": round(skill_score, 2),
        "title_score": round(title_score, 2),
        "experience_score": round(exp_score, 2),
        "location_score": round(location_score, 2),
        "matching_skills": skill_result["matching_skills"],
        "missing_skills": skill_result["missing_skills"]
    }


def rank_jobs_for_resume(resume: Resume, jobs: List[Job], min_score: float = 0.0) -> List[Dict]:
    """Rank jobs by match score for a given resume"""
    ranked = []
    
    for job in jobs:
        match_result = calculate_match_score(resume, job)
        if match_result["score"] >= min_score:
            ranked.append({
                "job": job,
                "match_score": match_result["score"],
                "details": match_result
            })
    
    # Sort by match score descending
    ranked.sort(key=lambda x: x["match_score"], reverse=True)
    
    return ranked
