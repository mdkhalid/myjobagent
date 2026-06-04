import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import Column, String, DateTime, Boolean, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, PyEnum):
    ADMIN = "admin"
    JOBSEEKER = "jobseeker"
    COMPANY = "company"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.JOBSEEKER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # ── Company-specific fields ──────────────────────────────────────────────
    company_name = Column(String, nullable=True, comment="Name of the company (for company accounts)")
    company_website = Column(String, nullable=True)
    company_size = Column(String, nullable=True, comment="e.g. 1-10, 11-50, 51-200, 201-1000, 1000+")
    industry = Column(String, nullable=True)
    company_description = Column(Text, nullable=True)
    company_logo_url = Column(String, nullable=True)

    # ── Jobseeker-specific fields ────────────────────────────────────────────
    phone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    headline = Column(String, nullable=True, comment="e.g. Senior Software Engineer at Google")
    linkedin_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)

    # Relationships
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="user", cascade="all, delete-orphan")
    posted_jobs = relationship("Job", back_populates="poster", foreign_keys="Job.poster_id", cascade="all, delete-orphan")
