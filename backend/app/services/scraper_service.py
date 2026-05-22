import random
import requests
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone

from app.models.job import Job, JobType
from app.db.session import SessionLocal


def generate_mock_jobs(keywords: str, location: Optional[str] = None, count: int = 20) -> List[Dict]:
    """Generate mock job data for testing"""
    companies = [
        "Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix", "Spotify",
        "Uber", "Airbnb", "Stripe", "Square", "Twitter", "LinkedIn", "Adobe",
        "Salesforce", "Oracle", "IBM", "Intel", "NVIDIA", "AMD", "Qualcomm",
        "Slack", "Zoom", "Shopify", "DoorDash", "Instacart", "Robinhood",
        "Coinbase", "Palantir", "Snowflake", "Datadog", "Cloudflare"
    ]
    
    titles = [
        "Software Engineer", "Senior Software Engineer", "Full Stack Developer",
        "Backend Engineer", "Frontend Engineer", "DevOps Engineer", "Data Engineer",
        "Machine Learning Engineer", "Site Reliability Engineer", "Cloud Architect",
        "Technical Lead", "Engineering Manager", "Principal Engineer", "Staff Engineer",
        "React Developer", "Python Developer", "Java Developer", "Go Developer",
        "Mobile Developer", "iOS Developer", "Android Developer", "Security Engineer"
    ]
    
    skills_pool = [
        "Python", "JavaScript", "TypeScript", "React", "Node.js", "AWS", "Docker",
        "Kubernetes", "SQL", "PostgreSQL", "MongoDB", "Redis", "GraphQL",
        "REST API", "Git", "CI/CD", "Terraform", "Machine Learning", "TensorFlow",
        "PyTorch", "Go", "Java", "C++", "Rust", "Ruby", "PHP", "Laravel",
        "Django", "Flask", "FastAPI", "Spring Boot", "Angular", "Vue.js",
        "HTML", "CSS", "Sass", "Tailwind", "Bootstrap", "Linux", "Bash"
    ]
    
    locations = ["San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX",
                 "Boston, MA", "Chicago, IL", "Denver, CO", "Remote", "Los Angeles, CA",
                 "Portland, OR", "Atlanta, GA", "Miami, FL", "Denver, CO", "Phoenix, AZ"]
    
    jobs = []
    for i in range(count):
        company = random.choice(companies)
        title = random.choice(titles)
        job_location = location if location else random.choice(locations)
        
        # Generate salary
        base_salary = random.randint(80, 200)
        salary_min = base_salary * 1000
        salary_max = (base_salary + random.randint(20, 60)) * 1000
        
        # Generate skills (3-8 random skills)
        num_skills = random.randint(3, 8)
        job_skills = random.sample(skills_pool, num_skills)
        
        # Posted date (within last 30 days)
        days_ago = random.randint(0, 30)
        posted_date = datetime.now(timezone.utc) - timedelta(days=days_ago)
        
        # Job type
        job_type = random.choice([JobType.FULL_TIME, JobType.CONTRACT, JobType.REMOTE])
        
        job = {
            "title": title,
            "company": company,
            "location": job_location,
            "description": f"We are looking for a talented {title} to join our team at {company}. "
                          f"The ideal candidate will have experience with {', '.join(job_skills[:3])}. "
                          f"You will be working on exciting projects that impact millions of users.",
            "requirements": [
                f"{random.randint(2, 8)}+ years of experience in software development",
                f"Strong proficiency in {', '.join(job_skills[:2])}",
                "Experience with agile development methodologies",
                "Excellent problem-solving skills",
                "Bachelor's degree in Computer Science or related field"
            ],
            "skills_required": job_skills,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": "USD",
            "job_type": job_type,
            "source": "mock",
            "external_id": f"mock_{i}_{random.randint(1000, 9999)}",
            "external_url": f"https://example.com/jobs/{i}",
            "posted_date": posted_date,
            "is_active": True
        }
        
        jobs.append(job)
    
    return jobs


def scrape_jobs(keywords: str, location: Optional[str] = None, source: str = "all") -> List[Dict]:
    """
    Scrape jobs from various sources.
    
    Free options available:
    1. RemoteOK - 100% free, no API key
    2. Adzuna - 500 calls/month free (needs API key)
    3. Findwork.dev - 100 calls/day free (needs API key)
    4. Mock data - Always works, for testing
    """
    all_jobs = []
    
    if source in ("all", "remoteok"):
        # Free, no API key needed
        remoteok_jobs = scrape_github_jobs(keywords, location)
        all_jobs.extend(remoteok_jobs)
    
    if source in ("all", "adzuna"):
        # Free tier: 500 calls/month (requires API key)
        adzuna_jobs = scrape_adzuna_jobs(keywords, location)
        all_jobs.extend(adzuna_jobs)
    
    # Fallback to mock data if no real jobs found
    if not all_jobs or source == "mock":
        mock_jobs = generate_mock_jobs(keywords, location, count=20)
        all_jobs.extend(mock_jobs)
    
    return all_jobs


def save_jobs_to_db(jobs_data: List[Dict]) -> int:
    """Save scraped jobs to database"""
    db = SessionLocal()
    saved_count = 0
    
    try:
        for job_data in jobs_data:
            # Check if job already exists (by external_id and source)
            existing = db.query(Job).filter(
                Job.external_id == job_data.get("external_id"),
                Job.source == job_data.get("source")
            ).first()
            
            if not existing:
                job = Job(**job_data)
                db.add(job)
                saved_count += 1
        
        db.commit()
    except Exception as e:
        print(f"Error saving jobs: {e}")
        db.rollback()
    finally:
        db.close()
    
    return saved_count


def scrape_github_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    """
    Scrape jobs from GitHub Jobs (free, no API key needed).
    Note: GitHub Jobs officially shut down, but many clones exist.
    Using remoteok.io as a free alternative.
    """
    jobs = []
    
    try:
        # RemoteOK API - free, no auth required
        url = "https://remoteok.com/api"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            for item in data[1:]:  # Skip first item (it's metadata)
                if not isinstance(item, dict):
                    continue
                    
                # Filter by keywords
                job_text = f"{item.get('position', '')} {item.get('description', '')}".lower()
                if keywords.lower() not in job_text:
                    continue
                
                # Filter by location if specified
                if location and location.lower() != "remote":
                    continue
                
                job = {
                    "title": item.get("position", "Unknown"),
                    "company": item.get("company", "Unknown"),
                    "location": location if location else (item.get("location") or "Remote"),
                    "description": item.get("description", "No description available"),
                    "requirements": [],
                    "skills_required": item.get("tags", []),
                    "salary_min": None,
                    "salary_max": None,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE,
                    "source": "remoteok",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True
                }
                jobs.append(job)
                
                if len(jobs) >= 20:
                    break
    except Exception as e:
        print(f"Error scraping RemoteOK: {e}")
    
    return jobs


def scrape_adzuna_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    """
    Scrape jobs from Adzuna API (free tier: 500 calls/month).
    Get your free API key at: https://developer.adzuna.com/
    """
    jobs = []
    
    # Add your Adzuna API credentials here
    APP_ID = "your_app_id"  # Replace with your App ID
    APP_KEY = "your_app_key"  # Replace with your API Key
    
    if APP_ID == "your_app_id":
        return jobs  # Skip if not configured
    
    try:
        url = "http://api.adzuna.com/v1/api/jobs/us/search/1"
        params = {
            "app_id": APP_ID,
            "app_key": APP_KEY,
            "results_per_page": 20,
            "what": keywords,
            "where": location or "",
            "content-type": "application/json"
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            for item in data.get("results", []):
                job = {
                    "title": item.get("title", "").replace("<strong>", "").replace("</strong>", ""),
                    "company": item.get("company", {}).get("display_name", "Unknown"),
                    "location": item.get("location", {}).get("display_name", location or "Unknown"),
                    "description": item.get("description", "No description available"),
                    "requirements": [],
                    "skills_required": keywords.split(),
                    "salary_min": item.get("salary_min"),
                    "salary_max": item.get("salary_max"),
                    "salary_currency": "USD",
                    "job_type": JobType.FULL_TIME,
                    "source": "adzuna",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("redirect_url", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True
                }
                jobs.append(job)
    except Exception as e:
        print(f"Error scraping Adzuna: {e}")
    
    return jobs
