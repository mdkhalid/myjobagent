import re
import random
import requests
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone

from app.models.job import Job, JobType
from app.db.session import SessionLocal


SALARY_PATTERNS = [
    r'\$(\d{2,3})[\s,]*[kK]',
    r'\$(\d{3,6})\s*-\s*\$(\d{3,6})',
    r'(\d{2,3})k\s*-\s*(\d{2,3})k',
    r'salary[:\s]*\$?(\d{2,6})',
    r'\$(\d{2,3}\.\d{3})\s*-\s*\$?(\d{2,3}\.\d{3})',
    r'(\d{2,6})\s*(?:usd|eur|gbp)',
]

LOCATION_ALIASES = {
    "sf": "san francisco", "bay area": "san francisco",
    "nyc": "new york city", "ny": "new york",
    "la": "los angeles", "seattle": "seattle",
    "remote": "remote", "anywhere": "remote",
    "us": "united states", "usa": "united states",
    "uk": "united kingdom", "london": "london, uk",
}


def _match_keywords(text: str, keywords: List[str]) -> bool:
    if not keywords:
        return True
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in keywords)


def _match_location(job_location: str, target_location: Optional[str]) -> bool:
    if not target_location:
        return True
    tgt = target_location.lower().strip()

    for alias, canonical in LOCATION_ALIASES.items():
        if tgt == alias:
            tgt = canonical
            break
    for alias, canonical in LOCATION_ALIASES.items():
        if job_location and alias in job_location.lower():
            job_location = canonical
            break

    if not job_location:
        return True

    job_loc = job_location.lower().strip()

    if "remote" in job_loc or "remote" in tgt:
        return True

    if job_loc == tgt:
        return True
    if tgt in job_loc or job_loc in tgt:
        return True

    tgt_parts = set(re.sub(r'[^a-z\s]', ' ', tgt).split())
    job_parts = set(re.sub(r'[^a-z\s]', ' ', job_loc).split())

    common = tgt_parts & job_parts
    if common and len(common) >= min(2, len(tgt_parts)):
        return True

    return False


def _extract_salary(description: str) -> tuple:
    if not description:
        return None, None
    for pattern in SALARY_PATTERNS:
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) == 1:
                val = groups[0].replace('.', '').replace(',', '').replace('k', '').replace('K', '')
                try:
                    num = float(val)
                    if num < 1000:
                        num *= 1000
                    return num, num * 1.3
                except ValueError:
                    continue
            elif len(groups) >= 2:
                try:
                    v1 = float(groups[0].replace('.', '').replace(',', '').replace('k', '').replace('K', ''))
                    v2 = float(groups[1].replace('.', '').replace(',', '').replace('k', '').replace('K', ''))
                    if v1 < 1000:
                        v1 *= 1000
                    if v2 < 1000:
                        v2 *= 1000
                    return v1, v2
                except ValueError:
                    continue
    return None, None


def _extract_skills_from_description(description: str, known_skills_pool: List[str]) -> List[str]:
    if not description:
        return []
    desc_lower = description.lower()
    found = set()
    for skill in known_skills_pool:
        s = skill.lower().strip()
        if len(s) > 1 and s in desc_lower:
            found.add(skill)
    return list(found)[:15]


def generate_mock_jobs(keywords: str, location: Optional[str] = None, count: int = 20) -> List[Dict]:
    companies = [
        "Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix", "Spotify",
        "Uber", "Airbnb", "Stripe", "Square", "Twitter", "LinkedIn", "Adobe",
        "Salesforce", "Oracle", "IBM", "Intel", "NVIDIA", "AMD", "Qualcomm",
        "Slack", "Zoom", "Shopify", "DoorDash", "Instacart", "Robinhood",
        "Coinbase", "Palantir", "Snowflake", "Datadog", "Cloudflare", "Vercel",
        "GitHub", "GitLab", "Figma", "Notion", "Linear", "Render", "Fly.io",
    ]

    titles = [
        "Software Engineer", "Senior Software Engineer", "Full Stack Developer",
        "Backend Engineer", "Frontend Engineer", "DevOps Engineer", "Data Engineer",
        "Machine Learning Engineer", "Site Reliability Engineer", "Cloud Architect",
        "Technical Lead", "Engineering Manager", "Principal Engineer", "Staff Engineer",
        "React Developer", "Python Developer", "Java Developer", "Go Developer",
        "Mobile Developer", "iOS Developer", "Android Developer", "Security Engineer",
        "AI Engineer", "Platform Engineer", "Infrastructure Engineer",
        "Database Engineer", "Systems Engineer", "QA Engineer", "Test Engineer",
    ]

    skills_pool = [
        "Python", "JavaScript", "TypeScript", "React", "Node.js", "AWS", "Docker",
        "Kubernetes", "SQL", "PostgreSQL", "MongoDB", "Redis", "GraphQL",
        "REST API", "Git", "CI/CD", "Terraform", "Machine Learning", "TensorFlow",
        "PyTorch", "Go", "Java", "C++", "Rust", "Ruby", "PHP", "Laravel",
        "Django", "Flask", "FastAPI", "Spring Boot", "Angular", "Vue.js",
        "HTML", "CSS", "Sass", "Tailwind", "Bootstrap", "Linux", "Bash",
        "GCP", "Azure", "Next.js", "Express", "Nginx", "RabbitMQ", "Kafka",
    ]

    locations = [
        "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX",
        "Boston, MA", "Chicago, IL", "Denver, CO", "Remote",
        "Los Angeles, CA", "Portland, OR", "Atlanta, GA", "Miami, FL",
        "Phoenix, AZ", "Dallas, TX", "San Diego, CA", "Remote",
        "Remote", "Remote",
    ]

    if keywords:
        kw_parts = [k.strip() for k in keywords.split(",")]
        relevant_titles = [t for t in titles if any(k.lower() in t.lower() for k in kw_parts)]
        if relevant_titles:
            titles = relevant_titles + titles[:5]

    jobs = []
    for i in range(count):
        company = random.choice(companies)
        title = random.choice(titles)
        job_location = location if location else random.choice(locations)

        base_salary = random.randint(80, 200)
        salary_min = base_salary * 1000
        salary_max = (base_salary + random.randint(20, 60)) * 1000

        num_skills = random.randint(4, 10)
        job_skills = random.sample(skills_pool, num_skills)

        days_ago = random.randint(0, 30)
        posted_date = datetime.now(timezone.utc) - timedelta(days=days_ago)

        types = [JobType.FULL_TIME, JobType.CONTRACT, JobType.REMOTE, JobType.PART_TIME]
        job_type = random.choice(types)

        description = (
            f"We are looking for a talented {title} to join our team at {company}. "
            f"The ideal candidate will have experience with {', '.join(job_skills[:4])}. "
            f"You will be working on exciting projects that impact millions of users. "
            f"Salary range: ${salary_min:,} - ${salary_max:,} per year."
        )

        jobs.append({
            "title": title,
            "company": company,
            "location": job_location,
            "description": description,
            "requirements": [
                f"{random.randint(2, 8)}+ years of experience in software development",
                f"Strong proficiency in {', '.join(job_skills[:3])}",
                "Experience with agile development methodologies",
                "Excellent problem-solving skills",
                "Bachelor's degree in Computer Science or related field",
            ],
            "skills_required": job_skills,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": "USD",
            "job_type": job_type,
            "source": "mock",
            "external_id": f"mock_{i}_{random.randint(10000, 99999)}",
            "external_url": f"https://example.com/jobs/{i}",
            "posted_date": posted_date,
            "is_active": True,
        })

    return jobs


def scrape_jobs(keywords: str, location: Optional[str] = None, source: str = "all") -> List[Dict]:
    from app.config import settings
    all_jobs = []
    keyword_list = [k.strip() for k in keywords.split(",")] if keywords else []

    scrapers = []

    if source in ("all", "remoteok"):
        scrapers.append(scrape_remoteok_jobs)
    if source in ("all", "remotive"):
        scrapers.append(scrape_remotive_jobs)
    if source in ("all", "jobicy"):
        scrapers.append(scrape_jobicy_jobs)
    if source in ("all", "jooble") and settings.JOOBLE_API_KEY:
        scrapers.append(lambda loc: scrape_jooble_jobs(keywords, loc))
    if source in ("all", "findwork") and settings.FINDWORK_API_KEY:
        scrapers.append(lambda loc: scrape_findwork_jobs(keywords, loc))
    if source in ("all", "adzuna"):
        scrapers.append(lambda loc: scrape_adzuna_jobs(keywords, loc))
    if source in ("all", "arbeitnow"):
        scrapers.append(scrape_arbeitnow_jobs)
    if source in ("all", "usajobs") and settings.USAJOBS_API_KEY:
        scrapers.append(lambda loc: scrape_usajobs_jobs(keywords, loc))

    for scraper_fn in scrapers:
        try:
            result = scraper_fn(location)
            for job in result:
                job_text = f"{job.get('title', '')} {job.get('company', '')} {job.get('description', '')}"
                if not keyword_list or _match_keywords(job_text, keyword_list):
                    job_text_lower = job_text.lower()
                    if not keyword_list or any(k.lower() in job_text_lower for k in keyword_list):
                        salary_min, salary_max = _extract_salary(job.get("description", ""))
                        if salary_min and not job.get("salary_min"):
                            job["salary_min"] = salary_min
                        if salary_max and not job.get("salary_max"):
                            job["salary_max"] = salary_max
                        all_jobs.append(job)
        except Exception as e:
            print(f"Scraper {scraper_fn.__name__} failed: {e}")

    if not all_jobs:
        print("All scrapers failed, generating mock fallback data")
        all_jobs = generate_mock_jobs(keywords, location, count=25)

    deduped = _deduplicate_jobs(all_jobs)

    return deduped


def _deduplicate_jobs(jobs: List[Dict]) -> List[Dict]:
    seen_titles = {}
    deduped = []

    for job in jobs:
        key = f"{job.get('title', '')}|{job.get('company', '')}".lower().strip()
        key = re.sub(r'\s+', ' ', key)

        if key not in seen_titles:
            seen_titles[key] = job
            deduped.append(job)
        else:
            existing = seen_titles[key]
            if len(job.get('description', '')) > len(existing.get('description', '')):
                deduped.remove(existing)
                deduped.append(job)
                seen_titles[key] = job

    return deduped


def save_jobs_to_db(jobs_data: List[Dict]) -> int:
    db = SessionLocal()
    saved_count = 0

    try:
        for job_data in jobs_data:
            existing = db.query(Job).filter(
                Job.external_id == job_data.get("external_id"),
                Job.source == job_data.get("source"),
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
                if not _match_location(item.get("location"), location):
                    continue
                desc = item.get("description", "")
                salary_min, salary_max = _extract_salary(desc)
                jobs.append({
                    "title": item.get("position", "Unknown"),
                    "company": item.get("company", "Unknown"),
                    "location": item.get("location") or "Remote",
                    "description": desc,
                    "requirements": [],
                    "skills_required": item.get("tags", []),
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE,
                    "source": "remoteok",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping RemoteOK: {e}")
    return jobs


def scrape_remotive_jobs(location: Optional[str] = None) -> List[Dict]:
    jobs = []
    try:
        url = "https://remotive.com/api/remote-jobs"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for item in data.get("jobs", []):
                if not _match_location(item.get("candidate_required_location"), location):
                    continue
                tags = item.get("tags", []) or []
                desc = item.get("description", "")
                salary_min, salary_max = _extract_salary(desc)
                jobs.append({
                    "title": item.get("title", "Unknown"),
                    "company": item.get("company_name", "Unknown"),
                    "location": item.get("candidate_required_location") or "Remote",
                    "description": desc,
                    "requirements": [],
                    "skills_required": tags,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE,
                    "source": "remotive",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping Remotive: {e}")
    return jobs


def scrape_jobicy_jobs(location: Optional[str] = None) -> List[Dict]:
    jobs = []
    try:
        url = "https://jobicy.com/api/v2/remote-jobs"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for item in data.get("jobs", []):
                geo = item.get("jobGeo", [])
                loc_str = ", ".join(geo) if geo else "Remote"
                if not _match_location(loc_str, location):
                    continue
                desc = item.get("jobDescription", "")
                salary_min, salary_max = _extract_salary(desc)
                jobs.append({
                    "title": item.get("jobTitle", "Unknown"),
                    "company": item.get("companyName", "Unknown"),
                    "location": loc_str,
                    "description": desc,
                    "requirements": [],
                    "skills_required": item.get("jobIndustry", []),
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE,
                    "source": "jobicy",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping Jobicy: {e}")
    return jobs


def scrape_jooble_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    from app.config import settings
    jobs = []
    api_key = settings.JOOBLE_API_KEY
    if not api_key:
        return jobs
    try:
        url = f"https://jooble.org/api/{api_key}"
        payload = {"keywords": keywords or "software", "location": location or ""}
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for item in data.get("jobs", []):
                desc = item.get("snippet", "")
                salary_min, salary_max = _extract_salary(desc)
                skills_from_kw = keywords.split() if keywords else []
                jobs.append({
                    "title": item.get("title", "Unknown"),
                    "company": item.get("company", "Unknown"),
                    "location": item.get("location", location or "Remote"),
                    "description": desc,
                    "requirements": [],
                    "skills_required": skills_from_kw,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE if (location or "").lower() == "remote" else JobType.FULL_TIME,
                    "source": "jooble",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("link", ""),
                    "posted_date": datetime.now(timezone.utc),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping Jooble: {e}")
    return jobs


def scrape_findwork_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    from app.config import settings
    jobs = []
    api_key = settings.FINDWORK_API_KEY
    if not api_key:
        return jobs
    try:
        url = "https://findwork.dev/api/jobs/"
        params = {"search": keywords or "software"}
        headers = {"Authorization": f"Token {api_key}"}
        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for item in data.get("results", []):
                loc = item.get("location") or ""
                if not _match_location(loc, location):
                    continue
                desc = item.get("text", "")
                salary_min, salary_max = _extract_salary(desc)
                skills_list = [s.strip() for s in item.get("keywords", "").split(",") if s.strip()]
                jobs.append({
                    "title": item.get("role", "Unknown"),
                    "company": item.get("company_name", "Unknown"),
                    "location": loc or "Remote",
                    "description": desc,
                    "requirements": [],
                    "skills_required": skills_list,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE if "remote" in loc.lower() else JobType.FULL_TIME,
                    "source": "findwork",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": item.get("date_posted") or datetime.now(timezone.utc),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping Findwork: {e}")
    return jobs


def scrape_adzuna_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    from app.config import settings
    jobs = []
    app_id = settings.ADZUNA_APP_ID
    app_key = settings.ADZUNA_APP_KEY
    if not app_id or not app_key:
        return jobs
    try:
        url = "http://api.adzuna.com/v1/api/jobs/us/search/1"
        params = {
            "app_id": app_id, "app_key": app_key,
            "results_per_page": 20, "what": keywords,
            "where": location or "", "content-type": "application/json",
        }
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for item in data.get("results", []):
                title = item.get("title", "").replace("<strong>", "").replace("</strong>", "")
                company = item.get("company", {}).get("display_name", "Unknown")
                loc_display = item.get("location", {}).get("display_name", location or "")
                category = item.get("category", {})
                skills = []
                if category:
                    skills.append(category.get("label", "").replace("/", ","))
                skills = [s.strip() for s in ",".join(skills).split(",") if s.strip()]
                desc = item.get("description", "")
                jobs.append({
                    "title": title,
                    "company": company,
                    "location": loc_display,
                    "description": desc,
                    "requirements": [],
                    "skills_required": skills,
                    "salary_min": item.get("salary_min"),
                    "salary_max": item.get("salary_max"),
                    "salary_currency": "USD",
                    "job_type": JobType.FULL_TIME,
                    "source": "adzuna",
                    "external_id": str(item.get("id", "")),
                    "external_url": item.get("redirect_url", ""),
                    "posted_date": (datetime.fromisoformat(item["created"].replace("Z", "+00:00"))
                                    if item.get("created") else datetime.now(timezone.utc)),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping Adzuna: {e}")
    return jobs


def scrape_arbeitnow_jobs(location: Optional[str] = None) -> List[Dict]:
    jobs = []
    try:
        url = "https://www.arbeitnow.com/api/job-board-api"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; JobAgent/1.0)"}
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            for item in data.get("data", []):
                loc = item.get("location", "")
                if not _match_location(loc, location):
                    continue
                desc = item.get("description", "")
                salary_min, salary_max = _extract_salary(desc)
                jobs.append({
                    "title": item.get("title", "Unknown"),
                    "company": item.get("company_name", "Unknown"),
                    "location": loc or "Remote",
                    "description": desc,
                    "requirements": [],
                    "skills_required": item.get("tags", []),
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": "USD",
                    "job_type": JobType.REMOTE if "remote" in loc.lower() else JobType.FULL_TIME,
                    "source": "arbeitnow",
                    "external_id": str(item.get("slug", "")),
                    "external_url": item.get("url", ""),
                    "posted_date": (datetime.fromtimestamp(item["created_at"])
                                    if item.get("created_at") else datetime.now(timezone.utc)),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping Arbeitnow: {e}")
    return jobs


def scrape_usajobs_jobs(keywords: str, location: Optional[str] = None) -> List[Dict]:
    from app.config import settings
    jobs = []
    api_key = settings.USAJOBS_API_KEY
    email = settings.USAJOBS_EMAIL
    if not api_key or not email:
        return jobs
    try:
        url = "https://data.usajobs.gov/api/Search"
        params = {"Keyword": keywords or "software", "ResultsPerPage": 20}
        if location:
            params["LocationName"] = location
        headers = {"Host": "data.usajobs.gov", "User-Agent": email, "Authorization-Key": api_key}
        response = requests.get(url, params=params, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            for item in data.get("SearchResult", {}).get("SearchResultItems", []):
                job_desc = item.get("MatchedObjectDescriptor", {})
                title = job_desc.get("PositionTitle", "Unknown")
                company = job_desc.get("OrganizationName", "U.S. Government")
                loc_parts = []
                for loc in job_desc.get("PositionLocation", []):
                    parts = [loc.get("CityName", ""), loc.get("State", ""), loc.get("CountryName", "")]
                    loc_parts.append(", ".join(p for p in parts if p))
                loc_str = "; ".join(loc_parts) if loc_parts else "United States"
                pay = job_desc.get("PositionRemuneration", [])
                salary_min = salary_max = None
                if pay:
                    try:
                        salary_min = float(pay[0].get("MinimumRange", 0)) or None
                        salary_max = float(pay[0].get("MaximumRange", 0)) or None
                    except (ValueError, TypeError):
                        pass
                desc = job_desc.get("QualificationSummary", "") or ""
                categories = job_desc.get("JobCategory", [])
                skills = [c.get("Name", "") for c in categories if c.get("Name")]
                posted = job_desc.get("PublicationStartDate")
                jobs.append({
                    "title": title,
                    "company": company,
                    "location": loc_str,
                    "description": desc,
                    "requirements": [],
                    "skills_required": skills,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": "USD",
                    "job_type": JobType.FULL_TIME,
                    "source": "usajobs",
                    "external_id": job_desc.get("PositionID", ""),
                    "external_url": job_desc.get("PositionURI", ""),
                    "posted_date": (datetime.fromisoformat(posted.replace("Z", "+00:00"))
                                    if posted else datetime.now(timezone.utc)),
                    "is_active": True,
                })
    except Exception as e:
        print(f"Error scraping USAJobs: {e}")
    return jobs
