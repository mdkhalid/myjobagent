import os
import re
from datetime import datetime
from typing import Dict, List, Any, Tuple
from docx import Document
import pypdf

from app.config import settings


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = pypdf.PdfReader(file)
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"Error extracting PDF: {e}")
    return text


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX file"""
    text = ""
    try:
        doc = Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"Error extracting DOCX: {e}")
    return text


def extract_text_from_doc(file_path: str) -> str:
    """Extract text from DOC file (fallback to basic extraction)"""
    # For .doc files, we'd need additional libraries like antiword
    # For now, return empty or try reading as text
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except:
        return ""


def extract_contact_info(text: str) -> Dict[str, str]:
    """Extract contact information from resume text"""
    contact_info = {
        "email": "",
        "phone": "",
        "linkedin": ""
    }
    
    # Extract email
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    email_match = re.search(email_pattern, text)
    if email_match:
        contact_info["email"] = email_match.group()
    
    # Extract phone
    phone_pattern = r'(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})'
    phone_match = re.search(phone_pattern, text)
    if phone_match:
        contact_info["phone"] = phone_match.group()
    
    # Extract LinkedIn
    linkedin_pattern = r'linkedin\.com/in/[a-zA-Z0-9-]+'
    linkedin_match = re.search(linkedin_pattern, text, re.IGNORECASE)
    if linkedin_match:
        contact_info["linkedin"] = linkedin_match.group()
    
    return contact_info


def extract_skills(text: str) -> List[str]:
    """Extract skills from resume text"""
    # Common tech skills list
    common_skills = [
        "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby", "php",
        "react", "angular", "vue", "svelte", "next.js", "node.js", "express", "django", "flask",
        "fastapi", "spring", "laravel", "rails",
        "html", "css", "sass", "less", "tailwind", "bootstrap", "material-ui",
        "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "dynamodb",
        "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "gitlab ci", "github actions",
        "terraform", "ansible", "puppet", "chef",
        "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
        "git", "github", "gitlab", "bitbucket", "jira", "confluence", "slack",
        "agile", "scrum", "kanban", "tdd", "ci/cd", "devops", "microservices",
        "rest api", "graphql", "grpc", "websockets", "oauth", "jwt",
        "linux", "unix", "bash", "powershell", "vim", "vscode"
    ]
    
    text_lower = text.lower()
    found_skills = []
    
    for skill in common_skills:
        # Look for whole word matches
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            found_skills.append(skill)
    
    return found_skills


def extract_experience(text: str) -> List[Dict[str, Any]]:
    """Extract work experience from resume text"""
    text = _normalize_text(text)
    experiences = []

    lines = text.split('\n')
    current_exp = {}

    # Date patterns covering common resume formats
    date_patterns = [
        r'(?:jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\.?\s+\d{4}\s*[-–—]\s*(?:(?:jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\.?\s+)?(?:\d{4}|present|current)',
        r'\d{1,2}/\d{4}\s*[-–—]\s*(?:\d{1,2}/)?(?:\d{4}|present|current)',
        r'\d{4}\s*[-–—]\s*(?:\d{4}|present|current)',
        r'\d{4}\s+to\s+(?:\d{4}|present|current)',
    ]
    date_regex = re.compile('|'.join(date_patterns), re.IGNORECASE)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if date_regex.search(line):
            if current_exp:
                experiences.append(current_exp)
            current_exp = {"dates": line}

        if len(line) < 100 and not current_exp.get("company"):
            if any(keyword in line.lower() for keyword in ["inc", "llc", "corp", "ltd", "company", "technologies"]):
                current_exp["company"] = line

    if current_exp:
        experiences.append(current_exp)

    return experiences


def extract_education(text: str) -> List[Dict[str, Any]]:
    """Extract education from resume text"""
    education = []
    
    # Look for education keywords
    edu_keywords = ["bachelor", "master", "phd", "bs", "ms", "ba", "ma", "degree"]
    lines = text.split('\n')
    
    for line in lines:
        line_lower = line.lower().strip()
        if any(keyword in line_lower for keyword in edu_keywords):
            education.append({"degree": line})
    
    return education


def _normalize_text(text: str) -> str:
    """Normalize Unicode dashes and whitespace for consistent regex matching"""
    # Replace common Unicode dashes with ASCII hyphen
    text = text.replace('\u2013', '-')  # en-dash
    text = text.replace('\u2014', '-')  # em-dash
    text = text.replace('\u2015', '-')  # horizontal bar
    text = text.replace('\u2212', '-')  # minus sign
    text = text.replace('\u2012', '-')  # figure dash
    text = text.replace('--', '-')     # double hyphen
    return text


def calculate_experience_years(text: str) -> int:
    """Calculate total years of experience from date ranges in text

    Collects all year intervals from the text, merges overlapping/adjacent
    ranges, and sums the contiguous spans to avoid double-counting concurrent
    or overlapping roles.
    """
    text = _normalize_text(text)

    current_year = datetime.now().year
    intervals: List[Tuple[int, int]] = []

    def try_add_interval(start_year: int, end_year: int) -> None:
        if end_year <= start_year:
            return
        if end_year - start_year >= 50:
            return
        intervals.append((start_year, end_year))

    # Pattern 0: "Jan 2018 - Present" or "Jan. 2018 - Dec. 2023"
    pattern0 = re.compile(
        r'(?:jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\.?\s+'
        r'(\d{4})\s*[-–—]\s*'
        r'(?:(?:jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\.?\s+)?'
        r'(\d{4}|present|current)',
        re.IGNORECASE
    )
    for m in pattern0.finditer(text):
        start_year = int(m.group(1))
        end_str = (m.group(2) or "").lower()
        end_year = current_year if end_str in ("present", "current") else int(end_str)
        try_add_interval(start_year, end_year)

    # Pattern 1: "01/2018 - 12/2023" or "01/2018 - Present"
    pattern1 = re.compile(
        r'(\d{1,2})/(\d{4})\s*[-–—]\s*'
        r'(?:(\d{1,2})/)?'
        r'(\d{4}|present|current)',
        re.IGNORECASE
    )
    for m in pattern1.finditer(text):
        start_year = int(m.group(2))
        end_str = (m.group(4) or "").lower()
        end_year = current_year if end_str in ("present", "current") else int(end_str)
        try_add_interval(start_year, end_year)

    # Pattern 2: "2018 - 2023" or "2018 - Present" (bare years)
    pattern2 = re.compile(
        r'(\d{4})\s*[-–—]\s*'
        r'(\d{4}|present|current)',
        re.IGNORECASE
    )
    for m in pattern2.finditer(text):
        start_year = int(m.group(1))
        end_str = (m.group(2) or "").lower()
        end_year = current_year if end_str in ("present", "current") else int(end_str)
        try_add_interval(start_year, end_year)

    # Pattern 3: "2018 to 2023" or "2018 to Present"
    pattern3 = re.compile(
        r'(\d{4})\s+to\s+'
        r'(\d{4}|present|current)',
        re.IGNORECASE
    )
    for m in pattern3.finditer(text):
        start_year = int(m.group(1))
        end_str = (m.group(2) or "").lower()
        end_year = current_year if end_str in ("present", "current") else int(end_str)
        try_add_interval(start_year, end_year)

    # Merge overlapping/adjacent intervals and sum their spans
    if not intervals:
        return 0

    intervals.sort()
    merged: List[Tuple[int, int]] = []
    cur_start, cur_end = intervals[0]

    for start, end in intervals[1:]:
        if start <= cur_end:  # overlapping or adjacent
            cur_end = max(cur_end, end)
        else:
            merged.append((cur_start, cur_end))
            cur_start, cur_end = start, end
    merged.append((cur_start, cur_end))

    total_years = sum(end - start for start, end in merged)
    return min(total_years, 30)  # Cap at 30 years


def extract_name(text: str) -> str:
    """Extract full name from resume"""
    lines = text.split('\n')
    
    # Usually name is in first few lines
    for line in lines[:5]:
        line = line.strip()
        # Look for capitalized words that look like names
        if line and len(line) < 50:
            words = line.split()
            if len(words) >= 2:
                # Check if it looks like a name (capitalized words)
                if all(word[0].isupper() for word in words if word):
                    return line
    
    return ""


def parse_resume_file(file_path: str) -> Dict[str, Any]:
    """Parse resume file and extract structured data"""
    # Determine file type and extract text
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.pdf':
        raw_text = extract_text_from_pdf(file_path)
    elif file_extension == '.docx':
        raw_text = extract_text_from_docx(file_path)
    elif file_extension == '.doc':
        raw_text = extract_text_from_doc(file_path)
    else:
        raw_text = ""
    
    # Extract structured information
    parsed_content = {
        "full_name": extract_name(raw_text),
        "email": "",
        "phone": "",
        "linkedin": "",
        "summary": "",
        "skills": [],
        "experience": [],
        "education": []
    }
    
    # Extract contact info
    contact_info = extract_contact_info(raw_text)
    parsed_content.update(contact_info)
    
    # Extract skills
    skills = extract_skills(raw_text)
    parsed_content["skills"] = skills
    
    # Extract experience
    experience = extract_experience(raw_text)
    parsed_content["experience"] = experience
    
    # Extract education
    education = extract_education(raw_text)
    parsed_content["education"] = education
    
    # Calculate experience years
    experience_years = calculate_experience_years(raw_text)
    
    return {
        "parsed_content": parsed_content,
        "skills": skills,
        "experience_years": experience_years,
        "raw_text": raw_text[:10000]  # Limit raw text
    }
