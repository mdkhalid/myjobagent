"""Generate formatted DOCX and PDF resumes with multiple template styles."""

import io
from typing import Optional

# DOCX
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

# PDF
from fpdf import FPDF

from app.services.templates import TemplateStyle, get_template, TemplateColors


def _make_safe_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in " _-." else "_" for c in name)


def _rgb(triple):
    return RGBColor(*triple)


def _hex_from_rgb(triple):
    """Convert RGB tuple to fpdf-compatible string."""
    return "#{:02x}{:02x}{:02x}".format(*triple)


# ── DOCX TEMPLATE RENDERERS ──────────────────────────────────────────────

def _docx_section_underline(doc, section: str, style: TemplateStyle):
    c = _rgb(style.colors.primary)
    p = doc.add_paragraph()
    r = p.add_run(section)
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = c
    r.font.name = style.font_heading
    # Underline border via XML
    pPr = p._p.get_or_add_pPr()
    pBdr = pPr.makeelement(qn("w:pBdr"), {})
    bottom = pBdr.makeelement(qn("w:bottom"), {
        qn("w:val"): "single",
        qn("w:sz"): "6",
        qn("w:space"): "1",
        qn("w:color"): "{:02x}{:02x}{:02x}".format(*style.colors.accent),
    })
    pBdr.append(bottom)
    pPr.append(pBdr)


def _docx_section_bar(doc, section: str, style: TemplateStyle):
    # Left bar + heading
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = pPr.makeelement(qn("w:pBdr"), {})
    left = pBdr.makeelement(qn("w:left"), {
        qn("w:val"): "single",
        qn("w:sz"): "24",
        qn("w:space"): "8",
        qn("w:color"): "{:02x}{:02x}{:02x}".format(*style.colors.accent),
    })
    pBdr.append(left)
    pPr.append(pBdr)
    r = p.add_run(section)
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = _rgb(style.colors.primary)
    r.font.name = style.font_heading


def _docx_section_minimal(doc, section: str, style: TemplateStyle):
    p = doc.add_paragraph()
    r = p.add_run(section)
    r.bold = True
    r.font.size = Pt(12)
    r.font.color.rgb = _rgb(style.colors.primary)
    r.font.name = style.font_heading


def _docx_section_badge(doc, section: str, style: TemplateStyle):
    # Badge-style: colored background highlight
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    shd = pPr.makeelement(qn("w:shd"), {
        qn("w:val"): "clear",
        qn("w:color"): "auto",
        qn("w:fill"): "{:02x}{:02x}{:02x}".format(*style.colors.accent),
    })
    pPr.append(shd)
    # Add spacing
    pPr.append(pPr.makeelement(qn("w:spacing"), {
        qn("w:before"): "120",
        qn("w:after"): "120",
    }))
    r = p.add_run(f"  {section}  ")
    r.bold = True
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    r.font.name = style.font_heading


SECTION_RENDERERS_DOCX = {
    "underline": _docx_section_underline,
    "bar": _docx_section_bar,
    "minimal": _docx_section_minimal,
    "badge": _docx_section_badge,
}


def generate_docx(
    tailored_text: str,
    candidate_name: str = "Candidate",
    job_title: str = "",
    template_name: str = "professional",
) -> bytes:
    """Generate a formatted .docx resume using the selected template."""
    style = get_template(template_name)
    doc = Document()

    # ── Default style ──
    normal = doc.styles["Normal"]
    normal.font.name = style.font_body
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = _rgb(style.colors.text)
    normal.paragraph_format.space_after = Pt(3)
    normal.paragraph_format.line_spacing = 1.15

    # ── Name ──
    align = WD_ALIGN_PARAGRAPH.CENTER if style.header_align == "center" else WD_ALIGN_PARAGRAPH.LEFT
    h = doc.add_heading(candidate_name, level=0)
    h.alignment = align
    for run in h.runs:
        run.font.size = Pt(22)
        run.font.color.rgb = _rgb(style.colors.primary)
        run.font.name = style.font_heading

    # Name underline
    if style.header_underline:
        p = doc.add_paragraph()
        p.alignment = align
        r = p.add_run(style.divider * 50)
        r.font.size = Pt(6)
        r.font.color.rgb = _rgb(style.colors.accent)
        r.font.name = style.font_heading

    # ── Tailored for line ──
    if job_title:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if style.header_align == "center" else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(f"Tailored for: {job_title}")
        r.font.size = Pt(9)
        r.font.color.rgb = _rgb(style.colors.accent)
        r.italic = True
        r.font.name = style.font_body

    doc.add_paragraph()  # spacer

    # ── Parse sections ──
    current_section = None
    lines = tailored_text.split("\n")
    section_renderer = SECTION_RENDERERS_DOCX.get(style.section_style, _docx_section_underline)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        stripped = line.strip("= ")
        if line.startswith("="):
            current_section = stripped
            section_renderer(doc, current_section, style)
        elif line.isupper() and len(line) > 2:
            current_section = line.title()
            section_renderer(doc, current_section, style)
        else:
            p = doc.add_paragraph(line)
            p.paragraph_format.space_after = Pt(2)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.getvalue()


# ── PDF TEMPLATE RENDERERS ──────────────────────────────────────────────


def _pdf_section_underline(pdf, section: str, style: TemplateStyle):
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*style.colors.primary)
    pdf.cell(0, 8, section, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*style.colors.accent)
    pdf.line(pdf.get_x(), pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)
    pdf.set_text_color(*style.colors.text)


def _pdf_section_bar(pdf, section: str, style: TemplateStyle):
    # Draw left bar
    x, y = pdf.get_x(), pdf.get_y()
    pdf.set_fill_color(*style.colors.accent)
    pdf.rect(x, y, 2, 8, style="F")
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*style.colors.primary)
    pdf.cell(8)  # indent after bar
    pdf.cell(0, 8, section, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_text_color(*style.colors.text)


def _pdf_section_minimal(pdf, section: str, style: TemplateStyle):
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*style.colors.primary)
    pdf.cell(0, 7, section, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_text_color(*style.colors.text)


def _pdf_section_badge(pdf, section: str, style: TemplateStyle):
    x = pdf.get_x()
    pdf.set_font("Helvetica", "B", 11)
    # Colored background
    pdf.set_fill_color(*style.colors.accent)
    pdf.set_text_color(255, 255, 255)
    text_w = pdf.get_string_width(section) + 8
    pdf.cell(text_w, 8, f"  {section}  ", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_text_color(*style.colors.text)


SECTION_RENDERERS_PDF = {
    "underline": _pdf_section_underline,
    "bar": _pdf_section_bar,
    "minimal": _pdf_section_minimal,
    "badge": _pdf_section_badge,
}


class ResumePDF(FPDF):
    def __init__(self, style: TemplateStyle):
        super().__init__()
        self.style = style
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*self.style.colors.secondary_text)
        self.cell(0, 10, f"Generated by Job Agent | {self.style.label} Template", align="C")


def generate_pdf(
    tailored_text: str,
    candidate_name: str = "Candidate",
    job_title: str = "",
    template_name: str = "professional",
) -> bytes:
    """Generate a formatted PDF resume using the selected template."""
    style = get_template(template_name)
    pdf = ResumePDF(style)
    pdf.add_page()

    # ── Name ──
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*style.colors.primary)
    if style.header_align == "center":
        pdf.cell(0, 14, candidate_name, new_x="LMARGIN", new_y="NEXT", align="C")
    else:
        pdf.cell(0, 14, candidate_name, new_x="LMARGIN", new_y="NEXT")

    # Name underline
    if style.header_underline:
        pdf.set_draw_color(*style.colors.accent)
        y = pdf.get_y()
        if style.header_align == "center":
            cw = pdf.get_string_width(candidate_name)
            cx = (pdf.w - cw) / 2
            pdf.line(cx, y, cx + cw, y)
        else:
            pdf.line(pdf.get_x(), y, pdf.get_x() + pdf.get_string_width(candidate_name), y)
        pdf.ln(4)

    # ── Tailored for ──
    if job_title:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*style.colors.accent)
        pdf.cell(0, 7, f"Tailored for: {job_title}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    pdf.ln(4)

    # ── Body ──
    pdf.set_text_color(*style.colors.text)
    section_renderer = SECTION_RENDERERS_PDF.get(style.section_style, _pdf_section_underline)

    lines = tailored_text.split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            pdf.ln(2)
            continue

        stripped = line.strip("= ")
        if line.startswith("="):
            section_renderer(pdf, stripped, style)
        elif line.isupper() and len(line) > 2:
            section_renderer(pdf, line.title(), style)
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*style.colors.text)
            pdf.multi_cell(0, 5, line)
            pdf.ln(1)

    return pdf.output()
