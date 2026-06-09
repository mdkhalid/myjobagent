"""Schemas for resume tailoring and ATS scoring."""

from typing import List, Optional
from pydantic import BaseModel


class Suggestion(BaseModel):
    id: str
    section: str  # summary, experience, skills, education
    original_text: str
    suggested_text: str
    reason: str
    type: str  # rewrite, add, remove


class AtsCategoryScores(BaseModel):
    keywords: float
    formatting: float
    experience: float
    education: float
    skills: float


class AtsScore(BaseModel):
    overall: float
    categories: AtsCategoryScores
    strengths: List[str]
    improvements: List[str]
    missing_keywords: List[str]


class TailorRequest(BaseModel):
    job_title: str
    job_description: str
    job_skills: Optional[List[str]] = None


class TailorResponse(BaseModel):
    suggestions: List[Suggestion]
    ats_score: AtsScore


class AtsScoreRequest(BaseModel):
    job_title: str
    job_description: str
    job_skills: Optional[List[str]] = None


class AtsScoreResponse(BaseModel):
    ats_score: AtsScore


class SaveTailoredRequest(BaseModel):
    """Save the tailored resume text."""
    tailored_text: str
    job_title: str = ""
    raw_text_snapshot: str = ""
    variant_id: Optional[str] = None  # keyword-optimized, achievement-focused, concise


class VariantInfo(BaseModel):
    """A single tailored variant."""
    id: str
    label: str
    description: str
    tailored_text: str
    ats_score: AtsScore


class TailorVariantsResponse(BaseModel):
    """Response containing multiple tailored variants."""
    variants: List[VariantInfo]
