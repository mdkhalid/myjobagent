"""
HTTP-based job search aggregator.

Searches multiple free job board APIs via HTTP requests (no browser needed).
Reuses the existing scraper_service functions so we don't duplicate logic.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.scraper_service import (
    scrape_remoteok_jobs,
    scrape_remotive_jobs,
    scrape_jobicy_jobs,
    scrape_jooble_jobs,
    scrape_findwork_jobs,
    scrape_adzuna_jobs,
    scrape_arbeitnow_jobs,
    scrape_usajobs_jobs,
)

logger = logging.getLogger(__name__)

# ── Data source metadata ─────────────────────────────────────────────────────

SOURCE_LABELS = {
    "remoteok": "RemoteOK",
    "remotive": "Remotive",
    "jobicy": "Jobicy",
    "jooble": "Jooble",
    "findwork": "Findwork.dev",
    "adzuna": "Adzuna",
    "arbeitnow": "Arbeitnow",
    "usajobs": "USAJobs",
}

SOURCE_PRIORITY = ["remoteok", "remotive", "jobicy", "jooble", "findwork", "adzuna", "arbeitnow", "usajobs"]


# ── Keyword relevance helpers ────────────────────────────────────────────────


def _extract_keywords(keywords: str) -> List[str]:
    """Extract meaningful individual keywords from a search string."""
    # Split on common separators and filter out very short words
    parts = re.split(r"[,;\s]+", keywords.lower().strip())
    return [p for p in parts if len(p) > 1]  # Skip single-letter words


def _score_job_relevance(job: Dict[str, Any], keywords: str) -> float:
    """
    Score a job's relevance to the given search keywords (0.0 - 1.0).

    Weights:
      - Title match:          0.40
      - Skills match:         0.30
      - Company match:        0.15
      - Description match:    0.15
    """
    if not keywords or not keywords.strip():
        return 0.5  # Neutral score when no keywords

    terms = _extract_keywords(keywords)
    if not terms:
        return 0.5

    # Prepare fields for matching
    title = (job.get("title") or "").lower()
    company = (job.get("company") or "").lower()
    description = (job.get("description") or "").lower()[:1000]
    skills_raw = job.get("skills_required") or job.get("tags") or []
    skills_str = " ".join(s.lower() for s in skills_raw if isinstance(s, str))

    # Compute per-field term hits
    title_hits = sum(1 for t in terms if t in title)
    skills_hits = sum(1 for t in terms if t in skills_str)
    company_hits = sum(1 for t in terms if t in company)
    desc_hits = sum(1 for t in terms if t in description)

    score = (
        (title_hits / len(terms)) * 0.40
        + (skills_hits / len(terms)) * 0.30
        + (company_hits / len(terms)) * 0.15
        + (desc_hits / len(terms)) * 0.15
    )
    return min(score, 1.0)


def _filter_relevant_jobs(
    jobs: List[Dict[str, Any]],
    keywords: str,
    min_score: float = 0.15,
    top_n: int = 50,
) -> List[Dict[str, Any]]:
    """
    Filter and sort jobs by keyword relevance.

    - Scores each job against the search keywords
    - Filters out jobs below min_score
    - Sorts by score descending
    - Returns top_n at most

    When keywords are very short or empty, returns all jobs with neutral scoring.
    """
    if not keywords or not keywords.strip():
        # No keywords — return as-is (limited to top_n)
        return jobs[:top_n]

    scored = []
    for job in jobs:
        score = _score_job_relevance(job, keywords)
        if score >= min_score:
            job["_relevance_score"] = round(score, 3)
            scored.append(job)

    # Sort by relevance descending
    scored.sort(key=lambda j: j.get("_relevance_score", 0), reverse=True)

    # Take top_n
    result = scored[:top_n]

    logger.info(
        "Keyword filter: %d/%d jobs passed (min_score=%.2f), %d returned",
        len(scored),
        len(jobs),
        min_score,
        len(result),
    )
    return result


# ── Public API ───────────────────────────────────────────────────────────────

def search_jobs_http(
    keywords: str,
    location: str = "",
    max_jobs: int = 25,
    sources: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Search for jobs across multiple free HTTP APIs.

    Results are filtered by keyword relevance to ensure only relevant jobs
    matching the search terms are returned.

    Args:
        keywords: Search terms (e.g. "Software Engineer").
        location:  Location filter (e.g. "Remote", "United States").
        max_jobs:  Maximum number of jobs to return.
        sources:   Which job board APIs to query (default: all free ones).

    Returns:
        A list of normalized job dicts, filtered and sorted by relevance.
    """
    if not sources:
        # Default: all free sources that don't require API keys
        sources = [s for s in SOURCE_PRIORITY if s in ("remoteok", "remotive", "jobicy", "arbeitnow")]

    all_jobs: List[Dict[str, Any]] = []
    seen_external_ids: set = set()

    for source in sources:
        if len(all_jobs) >= max_jobs * 3:
            # Fetch enough raw data to have good filtering material
            break

        try:
            jobs = _fetch_from_source(source, keywords, location)
            for job in jobs:
                eid = job.get("external_id", "")
                if eid and eid not in seen_external_ids:
                    seen_external_ids.add(eid)
                    all_jobs.append(_normalise_job(job, source))
                    if len(all_jobs) >= max_jobs * 3:
                        break
        except Exception as exc:
            logger.warning("Source %s returned error: %s", source, exc)
            continue

    # Apply keyword relevance filtering
    relevant = _filter_relevant_jobs(all_jobs, keywords, top_n=max_jobs)

    logger.info(
        "HTTP search: %d raw -> %d relevant from %d sources: %s",
        len(all_jobs), len(relevant), len(sources), sources,
    )
    return relevant


# ── Internal helpers ─────────────────────────────────────────────────────────

def _fetch_from_source(source: str, keywords: str, location: str) -> List[Dict]:
    """Dispatch to the appropriate scraper function."""
    if source == "remoteok":
        return scrape_remoteok_jobs(location if location else None)
    elif source == "remotive":
        return scrape_remotive_jobs(location if location else None)
    elif source == "jobicy":
        return scrape_jobicy_jobs(location if location else None)
    elif source == "jooble":
        return scrape_jooble_jobs(keywords, location if location else None)
    elif source == "findwork":
        return scrape_findwork_jobs(keywords, location if location else None)
    elif source == "adzuna":
        return scrape_adzuna_jobs(keywords, location if location else None)
    elif source == "arbeitnow":
        return scrape_arbeitnow_jobs(location if location else None)
    elif source == "usajobs":
        return scrape_usajobs_jobs(keywords, location if location else None)
    return []


def _normalise_job(raw: Dict[str, Any], source: str) -> Dict[str, Any]:
    """Normalise a raw job dict to our internal schema."""
    title = raw.get("title") or raw.get("position") or raw.get("role") or "Unknown"
    company = raw.get("company") or raw.get("company_name") or raw.get("companyName") or "Unknown"
    location = raw.get("location") or raw.get("candidate_required_location") or "Remote"
    description = raw.get("description") or raw.get("text") or raw.get("jobDescription") or ""
    external_url = raw.get("external_url") or raw.get("url") or raw.get("link") or raw.get("redirect_url") or ""

    skills = raw.get("skills_required") or raw.get("tags") or raw.get("jobIndustry") or []
    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]

    posted = raw.get("posted_date") or raw.get("date_posted") or datetime.now(timezone.utc)

    return {
        "title": title,
        "company": company,
        "location": location,
        "description": description,
        "job_link": external_url,
        "external_id": f"{source}_{raw.get('external_id', '')}",
        "source": source,
        "easy_apply": False,
        "posted_date": posted,
        "is_active": True,
        "salary_min": raw.get("salary_min"),
        "salary_max": raw.get("salary_max"),
        "salary_currency": raw.get("salary_currency", "USD"),
        "job_type": _resolve_job_type(raw, source),
        "skills_required": skills,
    }


def _resolve_job_type(raw: Dict, source: str) -> str:
    """Best-effort job type resolution."""
    jt = raw.get("job_type")
    if jt:
        return jt.value if hasattr(jt, "value") else str(jt)
    if source in ("remoteok", "remotive", "jobicy"):
        return "remote"
    return "full-time"
