from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from uuid import UUID


class Experience(BaseModel):
    company: str
    title: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None


class Education(BaseModel):
    institution: str
    degree: str
    field: Optional[str] = None
    graduation_date: Optional[str] = None


class ParsedContent(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = []
    experience: List[Experience] = []
    education: List[Education] = []


class ResumeBase(BaseModel):
    filename: str
    is_active: bool = True


class ResumeCreate(ResumeBase):
    pass


class ResumeUpdate(BaseModel):
    parsed_content: Optional[Dict[str, Any]] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[int] = None
    is_active: Optional[bool] = None


class ParsedResume(BaseModel):
    parsed_content: ParsedContent
    skills: List[str]
    experience_years: int
    raw_text: str


class ResumeResponse(ResumeBase):
    id: UUID
    user_id: UUID
    file_path: str
    parsed_content: Dict[str, Any]
    skills: List[str]
    experience_years: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
