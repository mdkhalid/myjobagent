"""Resume template definitions with distinct visual styles.

Each template defines colors, fonts, spacing, and layout rules
for both DOCX and PDF rendering.
"""

from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class TemplateColors:
    """RGB color tuples for a template."""
    primary: Tuple[int, int, int]       # Headings, name
    accent: Tuple[int, int, int]        # Accent elements (lines, badges)
    text: Tuple[int, int, int]          # Body text
    secondary_text: Tuple[int, int, int] # Subtitle / metadata
    background: Tuple[int, int, int]    # Card/header backgrounds
    border: Tuple[int, int, int]        # Lines / separators


@dataclass
class TemplateStyle:
    name: str
    label: str
    description: str
    colors: TemplateColors
    header_align: str           # "center" | "left"
    header_underline: bool      # line under name
    section_style: str          # "underline" | "bar" | "badge" | "minimal"
    font_heading: str           # DOCX heading font name
    font_body: str              # DOCX body font name
    show_icons: bool            # decorative icons on sections (PDF)
    divider: str                # section divider style


TEMPLATES: List[TemplateStyle] = [
    TemplateStyle(
        name="professional",
        label="Professional",
        description="Classic dark navy & Arial, similar to traditional resume formats",
        colors=TemplateColors(
            primary=(31, 73, 125),
            accent=(68, 114, 196),
            text=(0, 0, 0),
            secondary_text=(100, 116, 139),
            background=(255, 255, 255),
            border=(226, 232, 240),
        ),
        header_align="center",
        header_underline=True,
        section_style="underline",
        font_heading="Arial",
        font_body="Arial",
        show_icons=False,
        divider="─",
    ),
    TemplateStyle(
        name="classic",
        label="Classic",
        description="Traditional serif resume with burgundy accents, Georgia headings",
        colors=TemplateColors(
            primary=(96, 50, 52),
            accent=(160, 82, 70),
            text=(0, 0, 0),
            secondary_text=(120, 100, 100),
            background=(255, 252, 250),
            border=(226, 220, 218),
        ),
        header_align="center",
        header_underline=True,
        section_style="underline",
        font_heading="Georgia",
        font_body="Times New Roman",
        show_icons=False,
        divider="━",
    ),
    TemplateStyle(
        name="modern",
        label="Modern",
        description="Clean teal accents with left-bar sections, sans-serif",
        colors=TemplateColors(
            primary=(13, 148, 136),
            accent=(20, 184, 166),
            text=(30, 41, 59),
            secondary_text=(100, 116, 139),
            background=(248, 250, 252),
            border=(203, 213, 225),
        ),
        header_align="left",
        header_underline=False,
        section_style="bar",
        font_heading="Segoe UI",
        font_body="Segoe UI",
        show_icons=True,
        divider="▬",
    ),
    TemplateStyle(
        name="minimal",
        label="Minimal",
        description="Ultra-clean, maximum whitespace, neutral gray tones",
        colors=TemplateColors(
            primary=(71, 85, 105),
            accent=(148, 163, 184),
            text=(0, 0, 0),
            secondary_text=(148, 163, 184),
            background=(255, 255, 255),
            border=(226, 232, 240),
        ),
        header_align="left",
        header_underline=False,
        section_style="minimal",
        font_heading="Arial",
        font_body="Arial",
        show_icons=False,
        divider="·",
    ),
    TemplateStyle(
        name="executive",
        label="Executive",
        description="Premium navy & gold, bold header, distinguished serif",
        colors=TemplateColors(
            primary=(30, 41, 59),
            accent=(212, 175, 55),
            text=(0, 0, 0),
            secondary_text=(100, 116, 139),
            background=(250, 248, 245),
            border=(226, 232, 240),
        ),
        header_align="center",
        header_underline=True,
        section_style="badge",
        font_heading="Georgia",
        font_body="Calibri",
        show_icons=True,
        divider="◆",
    ),
]


def get_template(name: str) -> TemplateStyle:
    """Get a template by name. Falls back to 'professional'."""
    for t in TEMPLATES:
        if t.name == name:
            return t
    return TEMPLATES[0]


def list_templates() -> list:
    """Return template metadata for the frontend picker."""
    return [
        {
            "name": t.name,
            "label": t.label,
            "description": t.description,
        }
        for t in TEMPLATES
    ]
