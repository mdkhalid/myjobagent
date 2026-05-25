"""Pydantic request / response models for the Job Search API (HTTP-based)."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Filters ──────────────────────────────────────────────────────────────────

class SearchFilterOptions(BaseModel):
    date_posted: str = Field(default="")
    easy_apply_only: bool = Field(default=False)
    experience_level: List[str] = Field(default=[])
    job_type: List[str] = Field(default=[])
    on_site: List[str] = Field(default=[])
    sort_by: str = Field(default="")
    bad_words: List[str] = Field(default=[])
    about_company_good_words: List[str] = Field(default=[])


# ── Personal info ────────────────────────────────────────────────────────────

class PersonalInfo(BaseModel):
    first_name: str = Field(default="")
    last_name: str = Field(default="")
    phone_number: str = Field(default="")
    email: str = Field(default="")
    current_city: str = Field(default="")
    street: str = Field(default="")
    state: str = Field(default="")
    zipcode: str = Field(default="")
    country: str = Field(default="")
    headline: str = Field(default="")
    summary: str = Field(default="")
    cover_letter: str = Field(default="")
    website: str = Field(default="")
    linkedin_url: str = Field(default="")
    experience_years: str = Field(default="")
    notice_period: str = Field(default="")
    desired_salary: str = Field(default="")
    current_ctc: str = Field(default="")


class ApplicationQuestions(BaseModel):
    require_visa: str = Field(default="")
    us_citizenship: str = Field(default="")
    disability_status: str = Field(default="")
    veteran_status: str = Field(default="")
    gender: str = Field(default="")
    ethnicity: str = Field(default="")
    security_clearance: str = Field(default="")


# ── Config models ────────────────────────────────────────────────────────────

class SearchConfig(BaseModel):
    search_terms: List[str] = Field(..., min_length=1)
    location: str = Field(default="")
    max_jobs: int = Field(default=25, ge=1, le=100)
    filters: SearchFilterOptions = Field(default_factory=SearchFilterOptions)
    sources: List[str] = Field(default=[], description="Job board sources to query (empty = all free APIs)")


class ApplyConfig(BaseModel):
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    application_questions: ApplicationQuestions = Field(default_factory=ApplicationQuestions)
    resume_path: Optional[str] = Field(default=None)


# ── Request models ───────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    search: SearchConfig
    apply_config: ApplyConfig = Field(default_factory=ApplyConfig)
    resume_id: Optional[str] = Field(default=None)


class ApplyToJobRequest(BaseModel):
    job_ids: List[str] = Field(..., min_length=1)
    apply_config: ApplyConfig = Field(default_factory=ApplyConfig)
    resume_id: Optional[str] = Field(default=None)


# ── Match score model ────────────────────────────────────────────────────────

class MatchScore(BaseModel):
    score: float = Field(default=0.0, description="Overall match score 0-100")
    skill_score: float = Field(default=0.0)
    title_score: float = Field(default=0.0)
    experience_score: float = Field(default=0.0)
    matching_skills: List[str] = Field(default=[])
    missing_skills: List[str] = Field(default=[])


class JobWithMatch(BaseModel):
    id: Optional[str] = None
    title: str
    company: str
    location: str
    description: str = ""
    job_link: str = ""
    external_id: str = ""
    source: str = ""
    easy_apply: bool = False
    posted_date: Optional[Any] = None
    is_active: bool = True
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: str = "USD"
    job_type: str = ""
    skills_required: List[str] = Field(default=[])
    match_score: Optional[MatchScore] = Field(default=None, description="Match score against the user's resume")


# ── Response models ──────────────────────────────────────────────────────────

class JobSearchResponse(BaseModel):
    jobs: List[JobWithMatch]
    total_count: int
    message: str
    sources_used: List[str] = Field(default=[], description="Which job board APIs were queried")
    resume_used: Optional[str] = Field(default=None, description="Resume ID if used for scoring")


class ApplyResponse(BaseModel):
    success_count: int
    failed_jobs: List[Dict[str, str]]
    message: str
    applications_created: List[Dict[str, Any]] = Field(default=[])
