from celery import shared_task
from typing import Optional

from app.services.scraper_service import scrape_jobs, save_jobs_to_db


@shared_task(bind=True, max_retries=3)
def scrape_jobs_task(self, keywords: str, location: Optional[str] = None, source: str = "all"):
    """Scrape jobs and save to database"""
    try:
        # Scrape jobs
        jobs = scrape_jobs(keywords, location, source)
        
        # Save to database
        saved_count = save_jobs_to_db(jobs)
        
        return {
            "success": True,
            "jobs_found": len(jobs),
            "jobs_saved": saved_count,
            "keywords": keywords,
            "location": location
        }
    
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=300 * (2 ** self.request.retries))


@shared_task
def scheduled_job_scraping():
    """Scheduled task to scrape jobs periodically"""
    keywords_list = [
        "software engineer",
        "full stack developer",
        "backend engineer",
        "frontend engineer",
        "devops engineer",
        "data engineer"
    ]
    
    results = []
    for keywords in keywords_list:
        result = scrape_jobs_task.delay(keywords)
        results.append(result.id)
    
    return {
        "message": "Scheduled scraping started",
        "task_ids": results
    }
