"""
Unit tests for the HTTP job search scraper (app.linkedin.scraper).

Tests search_jobs_http, _normalise_job, _resolve_job_type, and _fetch_from_source
by mocking the scraper_service functions at the module level.
"""

from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from typing import Any, Dict, List

import pytest

from app.linkedin.scraper import (
    search_jobs_http,
    _normalise_job,
    _resolve_job_type,
    _fetch_from_source,
    SOURCE_PRIORITY,
    SOURCE_LABELS,
)


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def remoteok_raw() -> List[Dict[str, Any]]:
    """Simulates raw job dicts returned by scrape_remoteok_jobs (already normalised)."""
    return [
        {
            "title": "Senior Python Developer",
            "company": "PythonCorp",
            "location": "Remote",
            "description": "Build APIs with Python.",
            "tags": ["Python", "Django", "REST"],
            "external_id": "rok_001",
            "external_url": "https://remoteok.com/jobs/rok_001",
        },
        {
            "title": "Full Stack Python Engineer",
            "company": "CloudOps",
            "location": "Remote",
            "description": "Manage services with Python.",
            "tags": ["Python", "Docker"],
            "external_id": "rok_002",
            "external_url": "https://remoteok.com/jobs/rok_002",
        },
    ]


@pytest.fixture
def remotive_raw() -> List[Dict[str, Any]]:
    """Simulates raw job dicts returned by scrape_remotive_jobs (already normalised)."""
    return [
        {
            "title": "React Developer",
            "company": "FrontendCo",
            "location": "Europe",
            "description": "Build UIs with React.",
            "tags": ["React", "TypeScript", "CSS"],
            "external_id": "rem_001",
            "external_url": "https://remotive.com/jobs/rem_001",
        },
    ]


@pytest.fixture
def jobicy_raw() -> List[Dict[str, Any]]:
    """Simulates raw job dicts returned by scrape_jobicy_jobs (already normalised)."""
    return [
        {
            "title": "Python Backend Engineer",
            "company": "ServerSide",
            "location": "Remote, Worldwide",
            "description": "Design Python APIs.",
            "tags": ["Python", "Backend", "API"],
            "external_id": "job_001",
            "external_url": "https://jobicy.com/jobs/job_001",
        },
    ]


# ── search_jobs_http ─────────────────────────────────────────────────────────


class TestSearchJobsHttp:
    """Tests for the main search_jobs_http function."""

    def _patch_scrapers(
        self, raw_jobs: Dict[str, List[Dict]]
    ) -> Dict[str, MagicMock]:
        """Patch all scraper_service functions with the given return values."""
        def mock_scraper(source: str):
            m = MagicMock(return_value=raw_jobs.get(source, []))
            return m

        patchers = {
            "scrape_remoteok_jobs": mock_scraper("remoteok"),
            "scrape_remotive_jobs": mock_scraper("remotive"),
            "scrape_jobicy_jobs": mock_scraper("jobicy"),
        }

        # Apply patches
        patch_contexts = {
            name: patch(f"app.linkedin.scraper.{name}", mock)
            for name, mock in patchers.items()
        }
        for ctx in patch_contexts.values():
            ctx.start()

        return {name: patcher for name, patcher in patchers.items()}

    def _stop_patches(self, patches: Dict):
        for ctx in patches.values():
            ctx.stop()

    # ── Happy path ───────────────────────────────────────────────────────

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_search_returns_normalized_jobs(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
        remoteok_raw: List[Dict],
        remotive_raw: List[Dict],
        jobicy_raw: List[Dict],
    ):
        """All sources should contribute and results should be normalized."""
        mock_remoteok.return_value = remoteok_raw
        mock_remotive.return_value = remotive_raw
        mock_jobicy.return_value = jobicy_raw
        mock_arbeitnow.return_value = []

        results = search_jobs_http("Python Developer", "Remote")

        # 4 raw jobs, keyword filter keeps those with Python or Developer in title/skills/description
        # Senior Python Developer (matches: Python, Developer) ✓
        # Full Stack Python Engineer (matches: Python) ✓
        # React Developer (matches: Developer) ✓
        # Python Backend Engineer (matches: Python, Developer) ✓
        assert len(results) == 4
        # All should have our internal schema fields
        for job in results:
            assert "title" in job
            assert "company" in job
            assert "location" in job
            assert "description" in job
            assert "job_link" in job
            assert "external_id" in job
            assert "source" in job
            assert job["easy_apply"] is False
            assert job["is_active"] is True

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_external_id_includes_source_prefix(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
        remoteok_raw: List[Dict],
    ):
        """external_id should be prefixed with the source name."""
        mock_remoteok.return_value = remoteok_raw
        mock_remotive.return_value = []
        mock_jobicy.return_value = []
        mock_arbeitnow.return_value = []

        results = search_jobs_http("Python")

        # Both jobs have 'Python' in title and tags, so both pass keyword filter
        assert len(results) == 2
        for job in results:
            assert job["external_id"].startswith("remoteok_")
            assert job["source"] == "remoteok"

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_max_jobs_limit(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
    ):
        """Should not return more results than max_jobs."""
        # Include matching keywords so jobs pass the relevance filter
        many_jobs = [
            {"title": f"Python Developer {i}", "company": "Co",
             "external_id": f"id_{i}", "external_url": "", "tags": ["Python"]}
            for i in range(20)
        ]
        mock_remoteok.return_value = many_jobs
        mock_remotive.return_value = many_jobs
        mock_jobicy.return_value = many_jobs
        mock_arbeitnow.return_value = many_jobs

        results = search_jobs_http("Python", max_jobs=5)

        assert len(results) == 5

    # ── Deduplication ────────────────────────────────────────────────────

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_deduplicates_by_external_id(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
    ):
        """Jobs with the same external_id from same source should not be duplicated."""
        # Include Python in title so it passes keyword filter
        duplicate = [
            {"title": "Python Developer", "company": "Co",
             "external_id": "same_id", "external_url": "", "tags": ["Python"]},
        ]
        mock_remoteok.return_value = duplicate
        mock_remotive.return_value = []
        mock_jobicy.return_value = []
        mock_arbeitnow.return_value = []

        results = search_jobs_http("Python")

        assert len(results) == 1

    # ── Source filtering ─────────────────────────────────────────────────

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_custom_sources(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
        remoteok_raw: List[Dict],
        remotive_raw: List[Dict],
    ):
        """Should only query the explicitly provided sources."""
        mock_remoteok.return_value = remoteok_raw
        mock_remotive.return_value = remotive_raw
        mock_jobicy.return_value = []  # Should not be called if not in sources
        mock_arbeitnow.return_value = []

        # Important: we can't easily check 'not called' here since mock was set up,
        # so just verify only the expected sources appear
        results = search_jobs_http(
            "Python", sources=["remoteok", "remotive"]
        )

        # 2 remoteok (Python in title), 1 remotive (React Developer — "Developer" matches "Python" partially...
        # Actually "Developer" is not in keyword "Python", but "React Developer" has no "Python" either.
        # Let's check: keyword="Python", terms=["python"]. "React Developer" title has no "python" → 0.
        # So only 2 remoteok jobs pass the filter.
        assert len(results) == 2
        sources_used = {j["source"] for j in results}
        assert sources_used == {"remoteok"}

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_default_sources_when_none_provided(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
    ):
        """When sources=None, should default to free APIs (remoteok, remotive, jobicy, arbeitnow)."""
        mock_remoteok.return_value = []
        mock_remotive.return_value = []
        mock_jobicy.return_value = []
        mock_arbeitnow.return_value = []

        search_jobs_http("Python", sources=None)

        # All four should have been called
        mock_remoteok.assert_called_once()
        mock_remotive.assert_called_once()
        mock_jobicy.assert_called_once()
        mock_arbeitnow.assert_called_once()

    # ── Source error recovery ────────────────────────────────────────────

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_error_on_one_source_does_not_break_others(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
        remoteok_raw: List[Dict],
    ):
        """If one source raises, the other sources should still contribute."""
        mock_remoteok.side_effect = Exception("Network error")
        mock_remotive.return_value = []
        mock_jobicy.return_value = []
        mock_arbeitnow.return_value = []

        # Should not raise
        results = search_jobs_http("Python")

        assert isinstance(results, list)
        # remoteok failed, but no results from others -> empty
        assert len(results) == 0

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_partial_source_failure_still_returns_results(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
        remoteok_raw: List[Dict],
        remotive_raw: List[Dict],
    ):
        """When one source fails but others succeed, return success results."""
        mock_remoteok.return_value = remoteok_raw
        mock_remotive.side_effect = Exception("Remotive down")
        mock_jobicy.return_value = []
        mock_arbeitnow.return_value = []

        results = search_jobs_http("Python")

        # RemoteOK results from remoteok_raw both have Python in title → pass filter
        assert len(results) == 2
        for job in results:
            assert job["source"] == "remoteok"

    # ── Location parameter ──────────────────────────────────────────────

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_location_passed_to_scraper(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
    ):
        """Location parameter should be forwarded to scraper functions."""
        mock_remoteok.return_value = []
        mock_remotive.return_value = []
        mock_jobicy.return_value = []
        mock_arbeitnow.return_value = []

        search_jobs_http("Python", location="United States")

        mock_remoteok.assert_called_with("United States")
        mock_remotive.assert_called_with("United States")
        mock_jobicy.assert_called_with("United States")
        mock_arbeitnow.assert_called_with("United States")

    # ── Empty results ────────────────────────────────────────────────────

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_returns_empty_list_when_no_jobs(
        self,
        mock_jobicy: MagicMock,
        mock_remotive: MagicMock,
        mock_remoteok: MagicMock,
        mock_arbeitnow: MagicMock,
    ):
        """Should return an empty list when no sources yield jobs."""
        mock_remoteok.return_value = []
        mock_remotive.return_value = []
        mock_jobicy.return_value = []
        mock_arbeitnow.return_value = []

        results = search_jobs_http("Nonexistent Job")

        assert results == []


# ── _normalise_job ───────────────────────────────────────────────────────────


class TestNormaliseJob:
    """Tests for the _normalise_job helper function."""

    def test_standard_remoteok_format(self, remoteok_raw):
        """RemoteOK-style fields should be correctly normalized."""
        norm = _normalise_job(remoteok_raw[0], "remoteok")

        assert norm["title"] == "Senior Python Developer"
        assert norm["company"] == "PythonCorp"
        assert norm["location"] == "Remote"
        assert norm["description"] == "Build APIs with Python."
        assert norm["job_link"] == "https://remoteok.com/jobs/rok_001"
        assert norm["external_id"] == "remoteok_rok_001"
        assert norm["source"] == "remoteok"
        assert norm["job_type"] == "remote"

    def test_standard_remotive_format(self, remotive_raw):
        """Remotive-style fields should be correctly normalized."""
        norm = _normalise_job(remotive_raw[0], "remotive")

        assert norm["title"] == "React Developer"
        assert norm["company"] == "FrontendCo"
        assert norm["location"] == "Europe"
        assert norm["job_link"] == "https://remotive.com/jobs/rem_001"
        assert norm["external_id"] == "remotive_rem_001"
        assert norm["source"] == "remotive"

    def test_standard_jobicy_format(self, jobicy_raw):
        """Jobicy-style fields should be correctly normalized."""
        norm = _normalise_job(jobicy_raw[0], "jobicy")

        assert norm["title"] == "Python Backend Engineer"
        assert norm["company"] == "ServerSide"
        assert norm["location"] == "Remote, Worldwide"
        assert norm["job_link"] == "https://jobicy.com/jobs/job_001"
        assert norm["external_id"] == "jobicy_job_001"
        assert norm["source"] == "jobicy"

    def test_falls_back_when_title_missing(self):
        """Should fall back through keys and finally to 'Unknown'."""
        raw: Dict = {"company": "ACME", "external_id": "x"}
        norm = _normalise_job(raw, "remoteok")
        assert norm["title"] == "Unknown"

    def test_falls_back_position_when_title_missing(self):
        """Should try 'position' key before falling back."""
        raw = {"position": "Engineer", "company": "ACME", "external_id": "x"}
        norm = _normalise_job(raw, "remoteok")
        assert norm["title"] == "Engineer"

    def test_falls_back_role_when_title_and_position_missing(self):
        """Should try 'role' key before 'Unknown'."""
        raw = {"role": "Developer", "company": "ACME", "external_id": "x"}
        norm = _normalise_job(raw, "remoteok")
        assert norm["title"] == "Developer"

    def test_falls_back_company_name(self):
        """Should try company_name when company is missing."""
        raw = {"title": "Dev", "company_name": "ACME Inc", "external_id": "x"}
        norm = _normalise_job(raw, "remoteok")
        assert norm["company"] == "ACME Inc"

    def test_falls_back_to_remote_location(self):
        """Should default to 'Remote' when location is missing."""
        raw = {"title": "Dev", "company": "ACME", "external_id": "x", "external_url": ""}
        norm = _normalise_job(raw, "remoteok")
        assert norm["location"] == "Remote"

    def test_skills_list(self):
        """Skills/tags should be preserved as a list in skills_required."""
        raw = {
            "title": "Dev",
            "company": "ACME",
            "external_id": "x",
            "external_url": "",
            "tags": ["Python", "Django"],
        }
        norm = _normalise_job(raw, "remoteok")
        assert norm["external_id"] == "remoteok_x"
        assert norm["skills_required"] == ["Python", "Django"]

    def test_skills_as_comma_string(self):
        """Skills as a comma-separated string should be split into a list."""
        raw = {
            "title": "Dev",
            "company": "ACME",
            "external_id": "x",
            "external_url": "",
            "skills_required": "Python, Django, React",
        }
        norm = _normalise_job(raw, "remoteok")
        assert norm["skills_required"] == ["Python", "Django", "React"]

    def test_salary_fields_preserved(self):
        """Salary min/max/currency should pass through."""
        raw = {
            "title": "Dev",
            "company": "ACME",
            "external_id": "x",
            "external_url": "",
            "salary_min": 80000,
            "salary_max": 120000,
            "salary_currency": "USD",
        }
        norm = _normalise_job(raw, "remoteok")
        assert norm["salary_min"] == 80000
        assert norm["salary_max"] == 120000
        assert norm["salary_currency"] == "USD"

    def test_posted_date_defaults_to_now(self):
        """When no date is provided, should use current UTC time."""
        raw = {"title": "Dev", "company": "ACME", "external_id": "x", "external_url": ""}
        norm = _normalise_job(raw, "remoteok")
        assert isinstance(norm["posted_date"], datetime)
        assert norm["posted_date"].tzinfo is not None  # timezone-aware

    def test_posted_date_from_date_posted(self):
        """Should accept 'date_posted' key as fallback."""
        raw = {
            "title": "Dev",
            "company": "ACME",
            "external_id": "x",
            "external_url": "",
            "date_posted": "2026-05-01T00:00:00+00:00",
        }
        norm = _normalise_job(raw, "remoteok")
        # date_posted is a string — it will be passed through as-is since
        # _normalise_job doesn't parse strings (the orchestrator does)
        assert norm["posted_date"] == "2026-05-01T00:00:00+00:00"


# ── _resolve_job_type ────────────────────────────────────────────────────────


class TestResolveJobType:
    """Tests for the _resolve_job_type helper."""

    def test_uses_job_type_key(self):
        """Should return the value of 'job_type' when present."""
        raw = {"job_type": "contract"}
        assert _resolve_job_type(raw, "remoteok") == "contract"

    def test_job_type_with_enum_value(self):
        """Should handle job_type that has a .value attribute (e.g. Enum)."""
        class MockEnum:
            def __init__(self, v):
                self.value = v

        raw = {"job_type": MockEnum("full-time")}
        assert _resolve_job_type(raw, "remoteok") == "full-time"

    def test_default_remote_for_remoteok(self):
        """RemoteOK jobs should default to 'remote'."""
        raw = {}
        assert _resolve_job_type(raw, "remoteok") == "remote"

    def test_default_remote_for_remotive(self):
        """Remotive jobs should default to 'remote'."""
        raw = {}
        assert _resolve_job_type(raw, "remotive") == "remote"

    def test_default_remote_for_jobicy(self):
        """Jobicy jobs should default to 'remote'."""
        raw = {}
        assert _resolve_job_type(raw, "jobicy") == "remote"

    def test_default_full_time_for_other_sources(self):
        """Other sources should default to 'full-time'."""
        raw = {}
        assert _resolve_job_type(raw, "jooble") == "full-time"
        assert _resolve_job_type(raw, "findwork") == "full-time"
        assert _resolve_job_type(raw, "unknown") == "full-time"


# ── _fetch_from_source ───────────────────────────────────────────────────────


class TestFetchFromSource:
    """Tests for the _fetch_from_source dispatch function."""

    @patch("app.linkedin.scraper.scrape_remoteok_jobs")
    def test_dispatches_to_remoteok(self, mock_fn):
        """Should call scrape_remoteok_jobs for 'remoteok' source."""
        mock_fn.return_value = []
        _fetch_from_source("remoteok", "Python", "Remote")
        mock_fn.assert_called_once_with("Remote")

    @patch("app.linkedin.scraper.scrape_remotive_jobs")
    def test_dispatches_to_remotive(self, mock_fn):
        """Should call scrape_remotive_jobs for 'remotive' source."""
        mock_fn.return_value = []
        _fetch_from_source("remotive", "Python", "United States")
        mock_fn.assert_called_once_with("United States")

    @patch("app.linkedin.scraper.scrape_jobicy_jobs")
    def test_dispatches_to_jobicy(self, mock_fn):
        """Should call scrape_jobicy_jobs for 'jobicy' source."""
        mock_fn.return_value = []
        _fetch_from_source("jobicy", "Python", "Remote")
        mock_fn.assert_called_once_with("Remote")

    @patch("app.linkedin.scraper.scrape_jooble_jobs")
    def test_dispatches_to_jooble(self, mock_fn):
        """Should call scrape_jooble_jobs for 'jooble' source."""
        mock_fn.return_value = []
        _fetch_from_source("jooble", "Python Developer", "US")
        mock_fn.assert_called_once_with("Python Developer", "US")

    @patch("app.linkedin.scraper.scrape_findwork_jobs")
    def test_dispatches_to_findwork(self, mock_fn):
        """Should call scrape_findwork_jobs for 'findwork' source."""
        mock_fn.return_value = []
        _fetch_from_source("findwork", "Engineer", "Remote")
        mock_fn.assert_called_once_with("Engineer", "Remote")

    @patch("app.linkedin.scraper.scrape_adzuna_jobs")
    def test_dispatches_to_adzuna(self, mock_fn):
        """Should call scrape_adzuna_jobs for 'adzuna' source."""
        mock_fn.return_value = []
        _fetch_from_source("adzuna", "Python", "Remote")
        mock_fn.assert_called_once_with("Python", "Remote")

    @patch("app.linkedin.scraper.scrape_arbeitnow_jobs")
    def test_dispatches_to_arbeitnow(self, mock_fn):
        """Should call scrape_arbeitnow_jobs for 'arbeitnow' source."""
        mock_fn.return_value = []
        _fetch_from_source("arbeitnow", "Python", "Remote")
        mock_fn.assert_called_once_with("Remote")

    @patch("app.linkedin.scraper.scrape_usajobs_jobs")
    def test_dispatches_to_usajobs(self, mock_fn):
        """Should call scrape_usajobs_jobs for 'usajobs' source."""
        mock_fn.return_value = []
        _fetch_from_source("usajobs", "Software Engineer", "US")
        mock_fn.assert_called_once_with("Software Engineer", "US")

    def test_empty_for_unknown_source(self):
        """Should return empty list for unknown source."""
        result = _fetch_from_source("nonexistent", "Python", "Remote")
        assert result == []


# ── Module-level constants ────────────────────────────────────────────────────


class TestSourceMetadata:
    """Tests for module-level constants."""

    def test_source_labels_cover_priority(self):
        """Every source in SOURCE_PRIORITY should have a label."""
        for sid in SOURCE_PRIORITY:
            assert sid in SOURCE_LABELS, f"{sid} missing from SOURCE_LABELS"

    def test_source_priority_is_complete(self):
        """SOURCE_PRIORITY should include all known sources."""
        expected = ["remoteok", "remotive", "jobicy", "jooble", "findwork", "adzuna", "arbeitnow", "usajobs"]
        assert SOURCE_PRIORITY == expected

    def test_source_labels_have_readable_names(self):
        """Labels should be human-readable."""
        assert SOURCE_LABELS["remoteok"] == "RemoteOK"
        assert SOURCE_LABELS["remotive"] == "Remotive"
        assert SOURCE_LABELS["jobicy"] == "Jobicy"
        assert SOURCE_LABELS["adzuna"] == "Adzuna"
        assert SOURCE_LABELS["arbeitnow"] == "Arbeitnow"
        assert SOURCE_LABELS["usajobs"] == "USAJobs"
