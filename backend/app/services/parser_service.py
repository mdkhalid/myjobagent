import os
import re
from typing import Dict, List, Any
from docx import Document
import PyPDF2

from app.config import settings


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
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
    experiences = []
    
    # Look for common job title patterns
    lines = text.split('\n')
    current_exp = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for date patterns (experience sections often have dates)
        date_pattern = r'(\d{4})\s*-\s*(\d{4}|present|current)'
        if re.search(date_pattern, line, re.IGNORECASE):
            if current_exp:
                experiences.append(current_exp)
            current_exp = {"dates": line}
        
        # Check for company/title patterns
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


def calculate_experience_years(text: str) -> int:
    """Calculate total years of experience"""
    # Look for year ranges
    year_pattern = r'(\d{4})\s*-\s*(\d{4}|present|current)'
    matches = re.findall(year_pattern, text, re.IGNORECASE)
    
    total_years = 0
    current_year = 2024
    
    for start, end in matches:
        try:
            start_year = int(start)
            if end.lower() in ["present", "current"]:
                end_year = current_year
            else:
                end_year = int(end)
            
            years = end_year - start_year
            if years > 0 and years < 50:  # Sanity check
                total_years += years
        except:
            continue
    
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
