"""API routes for AI-powered resume tailoring and ATS scoring."""

import io
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
)
from app.services.ai_service import tailor_resume, calculate_ats_score
from app.services.document_service import generate_docx, generate_pdf, _make_safe_filename
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

    parsed = resume.parsed_content or {}
    parsed["tailored_versions"] = parsed.get("tailored_versions", [])
    parsed["tailored_versions"].append({
        "job_title": request.job_title,
        "tailored_text": request.tailored_text,
        "raw_text_snapshot": request.raw_text_snapshot,
    })
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
    template: str = Query("professional", regex="^(professional|modern|minimal|executive)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a tailored version as TXT, DOCX, or PDF with a selected template."""
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
    # Strip extension from filename for base name
    base_name = os.path.splitext(resume.filename or "resume")[0]
    safe_job = _make_safe_filename(job_title)

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
        docx_bytes = generate_docx(tailored_text, candidate_name, job_title, template)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_job}_{base_name}.docx"'},
        )

    elif fmt == "pdf":
        pdf_bytes = generate_pdf(tailored_text, candidate_name, job_title, template)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_job}_{base_name}.pdf"'},
        )

