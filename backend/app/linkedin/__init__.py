"""
Job Search Package
==================
HTTP-based job search across multiple free job board APIs.
No browser, no Selenium, no Chrome profile required.
"""
from app.linkedin.orchestrator import LinkedInOrchestrator

__all__ = ["LinkedInOrchestrator"]
