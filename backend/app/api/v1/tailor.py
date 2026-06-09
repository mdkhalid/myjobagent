"""API routes for AI-powered resume tailoring and ATS scoring."""

import copy
import io
import os
import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.schemas.tailor import (
    TailorRequest,
    TailorResponse,
    AtsScoreRequest,
    AtsScoreResponse,
    SaveTailoredRequest,
    TailorVariantsResponse,
    VariantInfo,
    AtsScore,
)
from app.services.ai_service import tailor_resume, calculate_ats_score, tailor_resume_variants
from app.services.document_service import (
    generate_docx, generate_pdf,
    generate_from_original_docx, _make_safe_filename,
)
from app.services.templates import list_templates

router = APIRouter()


@router.post("/tailor", response_model=TailorResponse)
async def tailor_resume_endpoint(
    resume_id: str,
    request: TailorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get AI-powered tailoring suggestions + ATS score for a resume against a JD."""
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id,
    ).first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    if not resume.raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no extracted text. Parse it first.",
        )

    try:
        result = tailor_resume(
            resume_text=resume.raw_text,
            job_title=request.job_title,
            job_description=request.job_description,
            job_skills=request.job_skills,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI tailoring failed: {str(e)}",
        )

    return TailorResponse(
        suggestions=result.get("suggestions", []),
        ats_score=result.get("ats_score", {}),
    )


@router.post("/ats-score", response_model=AtsScoreResponse)
async def ats_score_endpoint(
    resume_id: str,
    request: AtsScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get ATS score analysis only (faster, no tailoring suggestions)."""
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id,
    ).first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    if not resume.raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no extracted text. Parse it first.",
        )

    try:
        ats_score = calculate_ats_score(
            resume_text=resume.raw_text,
            job_title=request.job_title,
            job_description=request.job_description,
            job_skills=request.job_skills,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ATS scoring failed: {str(e)}",
        )

    return AtsScoreResponse(ats_score=ats_score)


@router.post("/variants", response_model=TailorVariantsResponse)
async def tailor_variants_endpoint(
    resume_id: str,
    request: TailorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate 3 complete tailored resume variants with different strategies.

    Returns full resume texts for:
    - Keyword Optimized (maximized ATS keyword density)
    - Achievement Focused (quantified accomplishments)
    - Concise & Impactful (tight, punchier bullets)
    """
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id,
    ).first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    if not resume.raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no extracted text. Parse it first.",
        )

    try:
        result = tailor_resume_variants(
            resume_text=resume.raw_text,
            job_title=request.job_title,
            job_description=request.job_description,
            job_skills=request.job_skills,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI variant generation failed: {str(e)}",
        )

    variants = result.get("variants", [])
    parsed_variants = []
    for v in variants:
        ats_data = v.get("ats_score", {})
        ats_score = AtsScore(
            overall=ats_data.get("overall", 0),
            categories=ats_data.get("categories", {}),
            strengths=ats_data.get("strengths", []),
            improvements=ats_data.get("improvements", []),
            missing_keywords=ats_data.get("missing_keywords", []),
        )
        parsed_variants.append(VariantInfo(
            id=v.get("id", "unknown"),
            label=v.get("label", "Variant"),
            description=v.get("description", ""),
            tailored_text=v.get("tailored_text", ""),
            ats_score=ats_score,
        ))

    return TailorVariantsResponse(variants=parsed_variants)


@router.post("/save-tailored", response_model=dict)
async def save_tailored_endpoint(
    resume_id: str,
    request: SaveTailoredRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save tailored resume and return version index for download."""
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id,
    ).first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    # Force-create a new dict so SQLAlchemy detects JSON column mutation
    parsed = copy.deepcopy(resume.parsed_content) if resume.parsed_content else {}
    versions = parsed.get("tailored_versions", [])
    versions.append({
        "job_title": request.job_title,
        "tailored_text": request.tailored_text,
        "raw_text_snapshot": request.raw_text_snapshot,
        "variant_id": request.variant_id or "",
    })
    parsed["tailored_versions"] = versions
    resume.parsed_content = parsed
    db.commit()
    db.refresh(resume)

    version_index = len(parsed["tailored_versions"]) - 1

    return {
        "status": "success",
        "message": "Tailored resume saved",
        "version_index": version_index,
    }


@router.get("/templates")
async def get_templates():
    """List available resume templates for the frontend picker."""
    return {"templates": list_templates()}


@router.get("/{resume_id}/tailored/{version_index}")
async def get_tailored_version(
    resume_id: str,
    version_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a saved tailored version's data."""
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id,
    ).first()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    parsed = resume.parsed_content or {}
    versions = parsed.get("tailored_versions", [])
    if version_index < 0 or version_index >= len(versions):
        raise HTTPException(status_code=404, detail="Version not found")

    version = versions[version_index]
    candidate_name = (resume.parsed_content or {}).get("full_name") or resume.filename or "Resume"

    return {
        "version_index": version_index,
        "resume_id": resume_id,
        "candidate_name": candidate_name,
        "filename": resume.filename or "resume",
        "job_title": version.get("job_title", ""),
        "tailored_text": version.get("tailored_text", ""),
        "templates": list_templates(),
    }


@router.get("/{resume_id}/tailored/{version_index}/download")
async def download_tailored(
    resume_id: str,
    version_index: int,
    fmt: str = Query("pdf", regex="^(txt|docx|pdf)$"),
    template: str = Query("professional", regex="^(professional|classic|modern|minimal|executive)$"),
    use_original: bool = Query(False, description="Use original resume DOCX as template (preserves formatting)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a tailored version as TXT, DOCX, or PDF.

    When ``use_original=True`` and downloading as DOCX, the original
    uploaded resume is used as the template — only text is changed while
    preserving all original formatting (fonts, colors, layout).
    """
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id,
    ).first()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    parsed = resume.parsed_content or {}
    versions = parsed.get("tailored_versions", [])
    if version_index < 0 or version_index >= len(versions):
        raise HTTPException(status_code=404, detail="Version not found")

    version = versions[version_index]
    job_title = version.get("job_title", "Tailored")
    tailored_text = version.get("tailored_text", "")
    candidate_name = (resume.parsed_content or {}).get("full_name") or resume.filename or "Resume"
    base_name = os.path.splitext(resume.filename or "resume")[0]
    safe_job = _make_safe_filename(job_title)

    # Try to use original DOCX as template when requested
    if use_original and fmt == "docx":
        try:
            docx_bytes = generate_from_original_docx(
                original_file_path=resume.file_path,
                tailored_text=tailored_text,
                candidate_name=candidate_name,
                job_title=job_title,
            )
            return Response(
                content=docx_bytes,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{safe_job}_{base_name}_tailored.docx"'},
            )
        except (FileNotFoundError, ValueError):
            # Fall through to template-based generation
            pass

    if fmt == "txt":
        content = f"""Tailored Resume — {job_title}
{'=' * 60}

{tailored_text}
"""
        return PlainTextResponse(
            content=content,
            headers={"Content-Disposition": f'attachment; filename="{safe_job}_{base_name}.txt"'},
        )

    elif fmt == "docx":
        docx_bytes = generate_docx(tailored_text, candidate_name, job_title, template, contact_info=contact_info)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_job}_{base_name}.docx"'},
        )

    elif fmt == "pdf":
        # Gather contact info from parsed resume + user profile to match original PDF layout
        pc = resume.parsed_content or {}
        raw_text = resume.raw_text or ""
        contact_parts = []

        # Location: try parsed_content, user profile, then search raw_text
        email = pc.get("email") or current_user.email or ""
        loc = pc.get("location") or pc.get("city") or current_user.location or ""
        if not loc and raw_text:
            # General approach: find the contact line (contains email with | separators) and extract location as first field
            if email:
                for line in raw_text.split('\n'):
                    if email in line and '|' in line:
                        parts = line.split('|')
                        candidate = parts[0].strip() if parts else ""
                        # Ensure it's not an email/URL/name
                        if candidate and not re.search(r'[@.\\/]', candidate) and candidate != candidate_name:
                            loc = candidate
                            break
        phone = pc.get("phone") or current_user.phone or ""
        linkedin = pc.get("linkedin") or ""
        # If no LinkedIn URL in parsed_content, check raw_text for "LinkedIn" word
        linkedin_label = "LinkedIn" if linkedin else ("LinkedIn" if raw_text and "linkedin" in raw_text[:200].lower() else "")
        if loc: contact_parts.append(loc)
        if email: contact_parts.append(email)
        if phone: contact_parts.append(phone)
        if linkedin_label: contact_parts.append(linkedin_label)
        contact_info = " | ".join(contact_parts) if contact_parts else ""

        pdf_bytes = generate_pdf(
            tailored_text, candidate_name, job_title, template,
            contact_info=contact_info,
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_job}_{base_name}.pdf"'},
        )

