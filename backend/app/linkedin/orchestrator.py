"""
LinkedIn / Smart Job Search orchestrator.

HTTP-only orchestrator that scrapes jobs via free APIs and persists them.
No browser, no Selenium, no Chrome profile.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.db.session import SessionLocal
from app.models.job import Job, JobType
from app.linkedin.scraper import search_jobs_http

logger = logging.getLogger(__name__)


class LinkedInOrchestrator:
    """
    Coordinates job search via HTTP APIs and database persistence.

    Usage::

        orch = LinkedInOrchestrator()
        orch.configure({"filters": {...}})
        jobs = orch.search_jobs("Software Engineer", "Remote")
        orch.save_jobs_to_db(jobs)
    """

    def __init__(self):
        self._config: Dict = {}

    def configure(self, config: Dict[str, Any]) -> None:
        """Persist configuration dict for downstream use."""
        self._config = config
        logger.info("Orchestrator configured (%d keys)", len(config))

    # ── Job search (HTTP only) ──────────────────────────────────────────────

    def search_jobs(self, keywords: str, location: str = "") -> List[Dict]:
        """
        Search jobs via HTTP APIs (no browser).

        Returns: list of normalised job dicts.
        """
        max_jobs = self._config.get("max_jobs", 25)
        sources = self._config.get("sources", None)

        jobs = search_jobs_http(
            keywords=keywords,
            location=location,
            max_jobs=max_jobs,
            sources=sources,
        )

        # Apply client-side filters
        filters = self._config.get("filters", {})
        if filters:
            jobs = self._apply_filters(jobs, filters)

        return jobs

    # ── Database persistence ────────────────────────────────────────────────

    def save_jobs_to_db(self, jobs: List[Dict]) -> int:
        """Insert new jobs into the database, avoiding duplicates."""
        db = SessionLocal()
        saved = 0
        try:
            for jd in jobs:
                existing = db.query(Job).filter(
                    Job.external_id == jd.get("external_id"),
                    Job.source == jd.get("source", "job_search"),
                ).first()
                if existing:
                    continue

                job_type_str = jd.get("job_type", "full-time")
                try:
                    job_type = JobType(job_type_str)
                except ValueError:
                    job_type = JobType.FULL_TIME

                posted = jd.get("posted_date")
                if isinstance(posted, str):
                    posted = datetime.fromisoformat(posted.replace("Z", "+00:00"))

                job = Job(
                    title=jd.get("title", ""),
                    company=jd.get("company", ""),
                    location=jd.get("location", ""),
                    description=jd.get("description", ""),
                    requirements=[],
                    skills_required=jd.get("skills_required", []),
                    salary_min=jd.get("salary_min"),
                    salary_max=jd.get("salary_max"),
                    salary_currency=jd.get("salary_currency", "USD"),
                    job_type=job_type,
                    source=jd.get("source", "job_search"),
                    external_id=jd.get("external_id"),
                    external_url=jd.get("job_link"),
                    posted_date=posted,
                    is_active=True,
                )
                db.add(job)
                saved += 1

            db.commit()
            logger.info("Saved %d new jobs to DB", saved)
        except Exception:
            logger.exception("Error saving jobs to DB")
            db.rollback()
        finally:
            db.close()
        return saved

    # ── Client-side filter application ──────────────────────────────────────

    def _apply_filters(self, jobs: List[Dict], filters: Dict) -> List[Dict]:
        """Apply bad_words / good_words / job_type filters client-side."""
        bad_words = filters.get("bad_words", [])
        good_words = filters.get("about_company_good_words", [])
        allowed_types = filters.get("job_type", [])

        filtered = []
        for j in jobs:
            text = f"{j.get('title', '')} {j.get('company', '')}".lower()

            if bad_words and any(w.lower() in text for w in bad_words):
                continue
            if good_words and not any(w.lower() in j.get("company", "").lower() for w in good_words):
                continue
            if allowed_types and j.get("job_type", "") not in allowed_types:
                continue

            filtered.append(j)

        return filtered

    # ── Cleanup (no-op, kept for backward compatibility) ────────────────────

    def close(self) -> None:
        """No-op. Kept for backward compatibility with callers that expect close()."""
        logger.debug("Orchestrator close() — no resources to release")
