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

        base_salary = random.randint(80, 200)
        salary_min = base_salary * 1000
        salary_max = (base_salary + random.randint(20, 60)) * 1000

        num_skills = random.randint(3, 8)
        job_skills = random.sample(skills_pool, num_skills)

        days_ago = random.randint(0, 30)
        posted_date = datetime.now(timezone.utc) - timedelta(days=days_ago)

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
    Scrape jobs from various free sources.

    No API key needed:
      1. RemoteOK  - remoteok.com/api
      2. Remotive  - remotive.com/api/remote-jobs
      3. Jobicy    - jobicy.com/api/v2/remote-jobs

    API key needed (set in .env / config):
      4. Jooble    - jooble.org/api  (JOOBLE_API_KEY)
      5. Adzuna    - developer.adzuna.com  (set keys in scraper_service.py)
    """
    from app.config import settings
    all_jobs = []

    if source in ("all", "remoteok"):
        all_jobs.extend(scrape_remoteok_jobs(location))

    if source in ("all", "remotive"):
        all_jobs.extend(scrape_remotive_jobs(location))

    if source in ("all", "jobicy"):
        all_jobs.extend(scrape_jobicy_jobs(location))

    if source in ("all", "jooble") and settings.JOOBLE_API_KEY:
        all_jobs.extend(scrape_jooble_jobs(keywords, location))

    if source in ("all", "findwork") and settings.FINDWORK_API_KEY:
        all_jobs.extend(scrape_findwork_jobs(keywords, location))

    if source in ("all", "adzuna"):
        all_jobs.extend(scrape_adzuna_jobs(keywords, location))

    return all_jobs


def save_jobs_to_db(jobs_data: List[Dict]) -> int:
    """Save scraped jobs to database"""
    db = SessionLocal()
    saved_count = 0

    try:
        for job_data in jobs_data:
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


def scrape_remoteok_jobs(location: Optional[str] = None) -> List[Dict]:
    """Scrape jobs from RemoteOK - 100% free, no API key needed."""
    jobs = []

    try:
        url = "https://remoteok.com/api"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()

            for item in data[1:]:
                if not isinstance(item, dict):
                    continue

                if location and location.lower() != "remote":
                    continue

                jobs.append({
                    "title": item.get("position", "Unknown"),
                    "company": item.get("company", "Unknown"),
                    "location": item.get("location") or "Remote",
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
                })

                if len(jobs) >= 30:
                    break
    except Exception as e:
        print(f"Error scraping RemoteOK: {e}")

    return jobs


def scrape_remotive_jobs(location: Optional[str] = None) -> List[Dict]:
    """Scrape jobs from Remotive - 100% free, no API key needed."""
    jobs = []

    try:
        url = "https://remotive.com/api/remote-jobs"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()

            for item in data.get("jobs", []):
                if location and location.lower() != "remote":
                    continue

                tags = item.get("tags", []) or []

                jobs.append({
                    "title": item.get("title", "Unknown"),
                    "company": item.get("company_name", "Unknown"),
                    "location": item.get("candidate_required_location") or "Remote",
                    "description": item.get("description", "No description available"),
                    "requirements": [],
                    "skills_required": tags,
                    "salary_min": None,
                    "salary_max": None,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE,
                    "source": "remotive",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True
                })

                if len(jobs) >= 30:
                    break
    except Exception as e:
        print(f"Error scraping Remotive: {e}")

    return jobs


def scrape_jobicy_jobs(location: Optional[str] = None) -> List[Dict]:
    """Scrape jobs from Jobicy - 100% free, no API key needed."""
    jobs = []

    try:
        url = "https://jobicy.com/api/v2/remote-jobs"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()

            for item in data.get("jobs", []):
                if location and location.lower() != "remote":
                    continue

                jobs.append({
                    "title": item.get("jobTitle", "Unknown"),
                    "company": item.get("companyName", "Unknown"),
                    "location": ", ".join(item.get("jobGeo", [])) or "Remote",
                    "description": item.get("jobDescription", "No description available"),
                    "requirements": [],
                    "skills_required": item.get("jobIndustry", []),
                    "salary_min": None,
                    "salary_max": None,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE,
                    "source": "jobicy",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True
                })

                if len(jobs) >= 30:
                    break
    except Exception as e:
        print(f"Error scraping Jobicy: {e}")

    return jobs


def scrape_jooble_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    """Scrape jobs from Jooble - free API key required (jooble.org/api)."""
    from app.config import settings
    jobs = []

    try:
        api_key = settings.JOOBLE_API_KEY
        if not api_key:
            return jobs

        url = f"https://jooble.org/api/{api_key}"
        payload = {"keywords": keywords or "software", "location": location or ""}
        headers = {"Content-Type": "application/json"}

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()

            for item in data.get("jobs", []):
                jobs.append({
                    "title": item.get("title", "Unknown"),
                    "company": item.get("company", "Unknown"),
                    "location": item.get("location", location or "Remote"),
                    "description": item.get("snippet", "No description available"),
                    "requirements": [],
                    "skills_required": keywords.split() if keywords else [],
                    "salary_min": None,
                    "salary_max": None,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE if location == "remote" else JobType.FULL_TIME,
                    "source": "jooble",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("link", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True
                })

                if len(jobs) >= 30:
                    break
    except Exception as e:
        print(f"Error scraping Jooble: {e}")

    return jobs


def scrape_findwork_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    """Scrape jobs from Findwork.dev - free API key required (findwork.dev/developers/)."""
    from app.config import settings
    jobs = []

    try:
        api_key = settings.FINDWORK_API_KEY
        if not api_key:
            return jobs

        url = "https://findwork.dev/api/jobs/"
        params = {"search": keywords or "software"}
        headers = {"Authorization": f"Token {api_key}"}

        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()

            for item in data.get("results", []):
                if location and location.lower() != "remote" and location.lower() not in item.get("location", "").lower():
                    continue

                jobs.append({
                    "title": item.get("role", "Unknown"),
                    "company": item.get("company_name", "Unknown"),
                    "location": item.get("location") or "Remote",
                    "description": item.get("text", "No description available"),
                    "requirements": [],
                    "skills_required": [s.strip() for s in item.get("keywords", "").split(",") if s.strip()],
                    "salary_min": None,
                    "salary_max": None,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE if "remote" in (item.get("location", "") or "").lower() else JobType.FULL_TIME,
                    "source": "findwork",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": item.get("date_posted") or datetime.now(timezone.utc),
                    "is_active": True
                })

                if len(jobs) >= 30:
                    break
    except Exception as e:
        print(f"Error scraping Findwork: {e}")

    return jobs


def scrape_adzuna_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    """
    Scrape jobs from Adzuna API (free tier: 500 calls/month).
    Get your free API key at: https://developer.adzuna.com/
    """
    jobs = []

    APP_ID = "your_app_id"
    APP_KEY = "your_app_key"

    if APP_ID == "your_app_id":
        return jobs

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
                jobs.append({
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
                })
    except Exception as e:
        print(f"Error scraping Adzuna: {e}")

    return jobs
