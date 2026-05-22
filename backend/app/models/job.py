import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, DateTime, Text, ARRAY, Numeric, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class JobType(str, PyEnum):
    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    REMOTE = "remote"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False, index=True)
    company = Column(String, nullable=False, index=True)
    location = Column(String)
    description = Column(Text)
    requirements = Column(ARRAY(String), default=[])
    skills_required = Column(ARRAY(String), default=[])
    salary_min = Column(Numeric(10, 2))
    salary_max = Column(Numeric(10, 2))
    salary_currency = Column(String, default="USD")
    job_type = Column(Enum(JobType), default=JobType.FULL_TIME)
    source = Column(String)
    external_id = Column(String, index=True)
    external_url = Column(String)
    posted_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    applications = relationship("Application", back_populates="job")
