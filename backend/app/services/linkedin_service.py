"""
Backward-compatible re-export of LinkedInOrchestrator as LinkedInService.

This file exists so that `from app.services.linkedin_service import LinkedInService`
continues to work during the transition to the new ``app.linkedin`` package.
"""

from app.linkedin.orchestrator import LinkedInOrchestrator as LinkedInService

__all__ = ["LinkedInService"]
