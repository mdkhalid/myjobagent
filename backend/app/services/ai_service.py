"""AI-powered resume tailoring and ATS scoring service using OpenAI."""

import json
from typing import List, Dict, Any, Optional
from openai import OpenAI

from app.config import settings


def _get_client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is not configured. Set it in your .env file."
        )
    return OpenAI(api_key=settings.OPENAI_API_KEY)


TAILOR_SYSTEM_PROMPT = """You are an expert ATS resume optimizer and career coach. Your job is to analyze a candidate's resume against a specific job description and provide actionable, line-by-line suggestions to maximize the match score.

For each suggestion, specify:
1. The **section** it belongs to (summary, experience, skills, education)
2. The **original text** from the resume (or empty if adding new content)
3. The **suggested text** (modified or new content)
4. The **reason** for the change (why it improves ATS match)
5. The **type**: "rewrite" (improve existing), "add" (insert new), or "remove" (delete irrelevant)

Rules:
- Preserve the candidate's authentic voice — don't fabricate experience
- Prioritize keywords from the job description
- Quantify achievements where the original has vague statements
- Keep bullet points concise and impactful
- Ensure all dates, company names, and degrees remain accurate
- If the resume lacks something the JD requires, suggest adding relevant transferable skills
- Return suggestions as a JSON array

Also return a comprehensive ATS score analysis with:
- overall_score (0-100)
- category_scores: { keywords, formatting, experience, education, skills }
- strengths: list of what the resume does well
- improvements: list of what needs work
- missing_keywords: list of important JD keywords missing from resume"""


def tailor_resume(
    resume_text: str,
    job_title: str,
    job_description: str,
    job_skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Send resume + job description to OpenAI and get tailored suggestions + ATS score."""
    client = _get_client()

    skills_text = ", ".join(job_skills) if job_skills else "Not specified"

    user_prompt = f"""## Job Description
**Title:** {job_title}
**Required Skills:** {skills_text}
**Description:**
{job_description}

## Current Resume
{resume_text}

## Instructions
Analyze the resume against this job description and return:
1. A list of specific, actionable tailoring suggestions
2. An ATS compatibility score with breakdown

Return valid JSON with this exact structure:
{{
  "suggestions": [
    {{
      "id": "sugg-1",
      "section": "summary|experience|skills|education",
      "original_text": "text from resume or empty string",
      "suggested_text": "rewritten or new text",
      "reason": "why this change helps",
      "type": "rewrite|add|remove"
    }}
  ],
  "ats_score": {{
    "overall": 75,
    "categories": {{
      "keywords": 70,
      "formatting": 80,
      "experience": 75,
      "education": 85,
      "skills": 65
    }},
    "strengths": ["Strong technical background in...", ...],
    "improvements": ["Add missing keywords...", ...],
    "missing_keywords": ["kubernetes", "terraform", ...]
  }}
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": TAILOR_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=4000,
    )

    result = json.loads(response.choices[0].message.content)
    return result


def calculate_ats_score(
    resume_text: str,
    job_title: str,
    job_description: str,
    job_skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get only the ATS score analysis without tailoring suggestions (faster, cheaper)."""
    client = _get_client()

    skills_text = ", ".join(job_skills) if job_skills else "Not specified"

    user_prompt = f"""## Job Description
**Title:** {job_title}
**Required Skills:** {skills_text}
**Description:**
{job_description}

## Current Resume
{resume_text}

## Instructions
Analyze this resume against the job description and return ONLY an ATS compatibility score with detailed breakdown.

Return valid JSON with this exact structure:
{{
  "ats_score": {{
    "overall": 75,
    "categories": {{
      "keywords": 70,
      "formatting": 80,
      "experience": 75,
      "education": 85,
      "skills": 65
    }},
    "strengths": ["Strong technical background in...", ...],
    "improvements": ["Add missing keywords...", ...],
    "missing_keywords": ["kubernetes", "terraform", ...]
  }}
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": TAILOR_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=2000,
    )

    result = json.loads(response.choices[0].message.content)
    return result.get("ats_score", result)
