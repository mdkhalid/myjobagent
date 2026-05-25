"""
Form field mapper for LinkedIn Easy Apply.

Maps user-configured personal info and application answers
to the correct form fields in LinkedIn's Easy Apply modal.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Answer maps ──────────────────────────────────────────────────────────────

YES_NO_PATTERNS: Dict[str, bool] = {
    "yes": True, "y": True, "true": True, "1": True,
    "no": False, "n": False, "false": False, "0": False,
}

# Keywords in field labels mapped to config keys
FIELD_KEYWORDS: Dict[str, str] = {
    # Contact
    "first name": "first_name", "first": "first_name",
    "last name": "last_name", "last": "last_name",
    "phone": "phone_number", "mobile": "phone_number", "cell": "phone_number",
    "email": "email", "e-mail": "email",

    # Location
    "city": "current_city", "town": "current_city",
    "street": "street", "address": "street",
    "state": "state", "province": "state", "region": "state",
    "zip": "zipcode", "postal": "zipcode", "post code": "zipcode",
    "country": "country",

    # Professional
    "headline": "headline", "title": "headline",
    "summary": "summary", "cover letter": "cover_letter",
    "website": "website", "portfolio": "website", "linkedin": "linkedin_url",

    # Experience
    "experience": "experience_years", "years": "experience_years",
    "notice": "notice_period", "notice period": "notice_period",
    "salary": "desired_salary", "desired salary": "desired_salary",
    "current ctc": "current_ctc", "current compensation": "current_ctc",

    # Questions
    "visa": "require_visa", "work authorization": "require_visa",
    "citizen": "us_citizenship", "citizenship": "us_citizenship",
    "disability": "disability_status",
    "veteran": "veteran_status",
    "gender": "gender",
    "ethnicity": "ethnicity",
    "clearance": "security_clearance", "security": "security_clearance",
}

# Default answers for common questions (matched by label keywords)
DEFAULT_ANSWERS: Dict[str, str] = {
    "disability_status": "Decline to self-identify",
    "veteran_status": "Decline to self-identify",
    "gender": "Decline to self-identify",
    "ethnicity": "Decline to self-identify",
    "us_citizenship": "",
    "require_visa": "No",
    "security_clearance": "No",
}


class FormFieldMapper:
    """
    Maps user-configured personal info / question answers to form fields.

    Usage:
        mapper = FormFieldMapper(config_dict)
        text_val = mapper.get_text_value(field_label, element_type)
        radio_val = mapper.get_radio_answer(field_label)
    """

    def __init__(self, config: Dict[str, Any]):
        self._personal = config.get("personal_info", {})
        self._questions = config.get("application_questions", {})
        self._merged: Dict[str, str] = {}

        # Merge: personal_info keys override defaults, questions override personal
        self._merged.update(DEFAULT_ANSWERS)
        if isinstance(self._personal, dict):
            for k, v in self._personal.items():
                if v:
                    self._merged[k] = str(v)
        if isinstance(self._questions, dict):
            for k, v in self._questions.items():
                if v:
                    self._merged[k] = str(v)

        self._resume_path = config.get("resume_path", None)

    # ── Public API ───────────────────────────────────────────────────────

    def get_text_value(self, label: str, element_type: str = "text") -> str:
        """
        Return the configured value for a text/textarea field by label.
        """
        key = self._match_label_to_key(label)
        if key:
            val = self._merged.get(key, "")
            logger.debug("Mapped '%s' -> %s = '%s'", label, key, val)
            return val
        return ""

    def get_radio_answer(self, label: str) -> str:
        """
        Return the configured value for a radio button / boolean group.
        """
        key = self._match_label_to_key(label)
        if key:
            val = self._merged.get(key, "")
            logger.debug("Radio '%s' -> %s = '%s'", label, key, val)
            return val

        # Try direct boolean matching
        text = label.lower().strip("?: ")
        if text in YES_NO_PATTERNS:
            return "Yes" if YES_NO_PATTERNS[text] else "No"

        return ""

    def get_dropdown_answer(self, label: str) -> str:
        """
        Return the configured value for a dropdown / select field.
        Same as get_radio_answer for now.
        """
        return self.get_radio_answer(label)

    def get_phone_value(self) -> str:
        """Return configured phone number."""
        return self._merged.get("phone_number", "")

    def get_resume_path(self) -> Optional[str]:
        """Return configured resume path."""
        return self._resume_path

    # ── Internal matching ────────────────────────────────────────────────

    def _match_label_to_key(self, label: str) -> Optional[str]:
        """Find the config key that matches a field label."""
        text = label.lower().strip("?:* ")
        for keyword, key in FIELD_KEYWORDS.items():
            if keyword in text:
                if key in self._merged and self._merged[key]:
                    return key
        return None
