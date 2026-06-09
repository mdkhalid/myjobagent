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



# ── Variant generation ──────────────────────────────────────────────────────

VARIANTS_SYSTEM_PROMPT = """You are an expert ATS resume optimizer and career coach. Your job is to rewrite a candidate's resume to match a specific job description.

You must return 3 COMPLETE tailored versions of the resume. Each version must be a FULL, complete resume text — not just suggestions.

Variant 1 — "Keyword Optimized":
- Maximize keyword density from the job description while reading naturally
- Reorder bullet points to put the most relevant experience first
- Add relevant keywords into the summary, experience bullets, and skills section
- Keep all factual information accurate (dates, company names, degrees)

Variant 2 — "Achievement Focused":
- Quantify achievements wherever possible (%, $, time saved, team size)
- Rewrite bullets to emphasize IMPACT rather than responsibilities
- Use strong action verbs and measurable outcomes
- Make the summary results-oriented with concrete metrics

Variant 3 — "Concise & Impactful":
- Tighten all language — remove filler words, weak verbs, redundancies
- Keep bullet points short and punchy (1-2 lines max)
- Prioritize only the most relevant experience for this job
- Make every word count; remove any generic statements

Rules for ALL variants:
- Preserve ALL factual information: dates, company names, job titles, degrees, institutions
- DO NOT fabricate experience or skills the candidate doesn't have
- Output each variant as a COMPLETE resume with:
  • Candidate name and contact at the top
  • PROFESSIONAL SUMMARY section
  • EXPERIENCE section (company, title, dates, location, bullet points)
  • SKILLS section
  • EDUCATION section
- Keep the same section structure as the original resume
- Use the exact same section header format (ALL CAPS with dashes)
- Return valid JSON only

Also return the ATS score analysis for each variant."""


def tailor_resume_variants(
    resume_text: str,
    job_title: str,
    job_description: str,
    job_skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Generate 3 complete tailored resume variants with different strategies."""
    client = _get_client()

    skills_text = ", ".join(job_skills) if job_skills else "Not specified"

    user_prompt = f"""## Job Description
**Title:** {job_title}
**Required Skills:** {skills_text}
**Description:**
{job_description}

## Current Resume
{resume_text}

Generate 3 COMPLETE tailored resume variants following the instructions in the system prompt.

Return valid JSON with this exact structure:
{{
  "variants": [
    {{
      "id": "keyword-optimized",
      "label": "Keyword Optimized",
      "description": "Maximized keyword density for ATS parsing",
      "tailored_text": "FULL resume text version 1...",
      "ats_score": {{ "overall": 85, "categories": {{ "keywords": 90, "formatting": 80, "experience": 75, "education": 85, "skills": 70 }}, "strengths": [], "improvements": [], "missing_keywords": [] }}
    }},
    {{
      "id": "achievement-focused",
      "label": "Achievement Focused",
      "description": "Emphasizing quantified accomplishments and impact",
      "tailored_text": "FULL resume text version 2...",
      "ats_score": {{ ... }}
    }},
    {{
      "id": "concise",
      "label": "Concise & Impactful",
      "description": "Tighter, punchier bullets with maximum impact",
      "tailored_text": "FULL resume text version 3...",
      "ats_score": {{ ... }}
    }}
  ]
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": VARIANTS_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
        max_tokens=8000,
    )

    result = json.loads(response.choices[0].message.content)
    return result


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
