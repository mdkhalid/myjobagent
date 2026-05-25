import re
from typing import List, Dict, Set, Optional
from difflib import SequenceMatcher

from app.models.resume import Resume
from app.models.job import Job


SKILL_SYNONYMS: Dict[str, List[str]] = {
    "react": ["react.js", "reactjs", "react-js", "react native"],
    "react.js": ["react", "reactjs", "react-js"],
    "reactjs": ["react", "react.js", "react-js"],
    "node.js": ["node", "nodejs", "node-js", "express", "express.js"],
    "nodejs": ["node", "node.js", "node-js", "express", "express.js"],
    "express": ["express.js", "node", "node.js", "nodejs"],
    "typescript": ["ts", "type script"],
    "javascript": ["js", "ecmascript", "es6", "es2015"],
    "python": ["python3", "python 3", "cpython"],
    "aws": ["amazon web services", "amazon webservices", "aws cloud"],
    "gcp": ["google cloud", "google cloud platform"],
    "azure": ["microsoft azure", "azure cloud"],
    "docker": ["docker.io", "containerization"],
    "kubernetes": ["k8s", "kube", "container orchestration"],
    "sql": ["postgresql", "mysql", "sqlite", "rdbms", "database"],
    "postgresql": ["postgres", "psql", "sql"],
    "mongodb": ["mongo", "nosql", "document database"],
    "redis": ["cache", "key-value store"],
    "graphql": ["gql", "graph ql"],
    "rest": ["restful", "rest api", "restapi"],
    "html": ["html5"],
    "css": ["css3", "stylesheet"],
    "tailwind": ["tailwindcss", "tailwind css"],
    "sass": ["scss", "sassy css"],
    "git": ["github", "gitlab", "git scm", "version control", "vcs"],
    "ci/cd": ["ci cd", "cicd", "continuous integration", "continuous deployment"],
    "tensorflow": ["tf", "tensor flow"],
    "pytorch": ["torch", "py torch"],
    "django": ["django framework"],
    "flask": ["flask framework"],
    "fastapi": ["fast api"],
    "spring boot": ["spring", "springboot", "spring framework"],
    "angular": ["angular.js", "angularjs", "angular 2+"],
    "vue.js": ["vue", "vuejs", "vue-js"],
    "java": ["java 8", "java 11", "java 17", "jdk", "jvm"],
    "go": ["golang"],
    "rust": ["rust-lang", "rustlang"],
    "c++": ["cpp", "c plus plus"],
    "c#": ["csharp", "c sharp", ".net"],
    ".net": ["dotnet", "dot net", "c#", "csharp"],
    "terraform": ["iac", "infrastructure as code"],
    "linux": ["unix", "bash", "shell", "posix"],
    "machine learning": ["ml", "machinelearning"],
    "deep learning": ["dl", "deeplearning"],
    "nlp": ["natural language processing"],
    "agile": ["scrum", "kanban", "agile development"],
}

TECH_KEYWORDS = {
    "engineer", "developer", "architect", "manager", "lead", "senior", "junior",
    "frontend", "backend", "fullstack", "full-stack", "devops", "data", "machine",
    "learning", "software", "web", "mobile", "cloud", "security", "site",
    "reliability", "platform", "infrastructure", "database", "qa", "test",
    "embedded", "systems", "network", "ai", "ml", "sre", "principal",
    "staff", "technical", "tech lead", "intern", "entry", "graduate",
}


def normalize_skill(skill: str) -> str:
    skill = skill.lower().strip()
    skill = re.sub(r'[^a-z0-9\s]', '', skill)
    skill = re.sub(r'\s+', '', skill)
    return skill


def expand_skill_synonyms(skill: str) -> Set[str]:
    normalized = skill.lower().strip()
    expanded = {normalized, normalize_skill(normalized)}
    for canonical, aliases in SKILL_SYNONYMS.items():
        if normalize_skill(skill) == normalize_skill(canonical):
            for alias in aliases:
                expanded.add(alias.lower().strip())
                expanded.add(normalize_skill(alias))
        for alias in aliases:
            if normalize_skill(skill) == normalize_skill(alias):
                expanded.add(canonical.lower().strip())
                expanded.add(normalize_skill(canonical))
    return expanded


def extract_skills_from_text(text: str, known_skills: List[str]) -> List[str]:
    if not text:
        return []
    text_lower = text.lower()
    found = []
    for skill in known_skills:
        if skill.lower() in text_lower:
            found.append(skill)
    return found


def calculate_skill_match(resume_skills: List[str], job_skills: List[str], job_description: str = "") -> Dict:
    if not job_skills and not job_description:
        return {
            "match_percentage": 100.0,
            "matching_skills": [],
            "missing_skills": []
        }

    normalized_resume = {normalize_skill(s) for s in resume_skills}
    resume_expanded: Set[str] = set()
    for s in resume_skills:
        resume_expanded.update(expand_skill_synonyms(s))
    resume_expanded.update(normalized_resume)

    matching_skills = []
    missing_skills = []

    all_job_skills = list(job_skills)
    if job_description:
        extra_skills = extract_skills_from_text(job_description, resume_skills)
        for es in extra_skills:
            if es not in all_job_skills:
                all_job_skills.append(es)

    for job_skill in all_job_skills:
        job_norm = normalize_skill(job_skill)
        job_expanded = expand_skill_synonyms(job_skill)

        matched = bool(job_expanded & resume_expanded)

        if not matched:
            for rs in resume_skills:
                rs_norm = normalize_skill(rs)
                similarity = SequenceMatcher(None, job_norm, rs_norm).ratio()
                if similarity > 0.75:
                    matched = True
                    break

        if matched:
            if job_skill not in matching_skills:
                matching_skills.append(job_skill)
        else:
            if job_skill not in missing_skills:
                missing_skills.append(job_skill)

    denominator = len(all_job_skills) if all_job_skills else 1
    match_percentage = (len(matching_skills) / denominator) * 100

    return {
        "match_percentage": round(min(match_percentage, 100.0), 2),
        "matching_skills": matching_skills,
        "missing_skills": missing_skills
    }


def calculate_title_match(resume_title: str, job_title: str, resume_skills: List[str] = None) -> float:
    if not resume_title or not job_title:
        return 50.0

    r_words = set(re.sub(r'[^a-z\s]', '', resume_title.lower()).split())
    j_words = set(re.sub(r'[^a-z\s]', '', job_title.lower()).split())

    r_tech = r_words & TECH_KEYWORDS
    j_tech = j_words & TECH_KEYWORDS

    base_score = 50.0
    if j_tech:
        overlap = len(r_tech & j_tech)
        if overlap > 0:
            base_score = (overlap / len(j_tech)) * 100

    r_all_lower = resume_title.lower()
    j_all_lower = job_title.lower()
    full_overlap_ratio = SequenceMatcher(None, r_all_lower, j_all_lower).ratio()
    if full_overlap_ratio > 0.3:
        base_score = max(base_score, full_overlap_ratio * 100)

    common_roles = {
        ("fullstack", "full-stack", "web"): {"fullstack", "full-stack", "web", "software", "engineer", "developer"},
        ("frontend", "ui", "ux"): {"frontend", "ui", "ux", "web", "engineer", "developer"},
        ("backend", "api", "server"): {"backend", "api", "server", "engineer", "developer"},
        ("data", "ml", "machine learning", "ai"): {"data", "ml", "machine", "learning", "ai", "engineer", "scientist"},
        ("devops", "sre", "infrastructure"): {"devops", "sre", "infrastructure", "engineer"},
        ("mobile", "ios", "android"): {"mobile", "ios", "android", "engineer", "developer"},
    }
    for role_keywords, role_set in common_roles.items():
        if any(kw in j_all_lower for kw in role_keywords) and any(kw in r_all_lower for kw in role_keywords):
            bonus = 20.0 if r_tech & j_tech else 10.0
            base_score = min(base_score + bonus, 100.0)

    return round(base_score, 2)


def calculate_experience_match(resume_years: int, job_requirements: List[str], job_description: str = "") -> float:
    required_years = None

    all_text = " ".join(job_requirements or []) + " " + (job_description or "")

    patterns = [
        r'(\d+)\+?\s*years?\s*of\s*experience',
        r'(\d+)\+?\s*years?\s*experience',
        r'(\d+)\+?\s*years?',
        r'minimum\s+of\s+(\d+)\s*years?',
        r'at\s+least\s+(\d+)\s*years?',
        r'(\d+)\s*\+\s*years?',
    ]

    for pattern in patterns:
        match = re.search(pattern, all_text.lower())
        if match:
            required_years = int(match.group(1))
            break

    if not required_years:
        return 100.0

    if resume_years >= required_years:
        return 100.0
    elif resume_years >= required_years * 0.8:
        return 80.0
    elif resume_years >= required_years * 0.5:
        return 50.0
    else:
        return max(10.0, (resume_years / required_years) * 100)


def calculate_location_match(resume_location: str, job_location: str) -> float:
    if not job_location:
        return 100.0
    if not resume_location:
        return 50.0

    resume_loc = resume_location.lower().strip()
    job_loc = job_location.lower().strip()

    if "remote" in job_loc or "remote" in resume_loc:
        return 100.0

    if resume_loc == job_loc:
        return 100.0

    r_parts = set(re.sub(r'[^a-z\s]', ' ', resume_loc).split())
    j_parts = set(re.sub(r'[^a-z\s]', ' ', job_loc).split())
    common = r_parts & j_parts
    if common:
        overlap = len(common) / max(len(j_parts), 1)
        if overlap >= 0.5:
            return 80.0

    for prefix in ["san francisco", "new york", "los angeles", "seattle", "austin",
                     "boston", "chicago", "denver", "portland", "atlanta", "miami"]:
        if prefix in resume_loc and prefix in job_loc:
            return 75.0

    common_words = {"remote", "united states", "us", "usa", "ca", "ny", "tx", "wa",
                     "or", "ma", "il", "co", "ga", "fl", "az"}
    r_words = {w for w in r_parts if len(w) > 1}
    j_words = {w for w in j_parts if len(w) > 1}
    if r_words & j_words:
        overlap = len(r_words & j_words) / max(len(j_words), 1)
        if overlap >= 0.3:
            return 60.0

    return 30.0


def extract_title_from_content(parsed_content: Dict) -> str:
    if not parsed_content:
        return ""
    for key in ["title", "position", "job_title", "current_title"]:
        val = parsed_content.get(key)
        if val:
            return str(val)
    experience = parsed_content.get("experience") or parsed_content.get("work_experience") or []
    if experience and isinstance(experience, list):
        first = experience[0]
        if isinstance(first, dict):
            return str(first.get("title") or first.get("position") or "")
    return ""


def extract_location_from_content(parsed_content: Dict) -> str:
    if not parsed_content:
        return ""
    for key in ["location", "city", "address", "current_location"]:
        val = parsed_content.get(key)
        if val:
            return str(val)
    contact = parsed_content.get("contact") or parsed_content.get("personal_info") or {}
    if isinstance(contact, dict):
        for key in ["location", "city", "address"]:
            val = contact.get(key)
            if val:
                return str(val)
    return ""


def calculate_match_score(resume: Resume, job: Job) -> Dict:
    resume_skills = resume.skills or []
    job_skills = job.skills_required or []
    job_requirements = job.requirements or []
    job_description = job.description or ""

    skill_result = calculate_skill_match(resume_skills, job_skills, job_description)
    skill_score = skill_result["match_percentage"]

    resume_title = extract_title_from_content(resume.parsed_content or {})
    title_score = calculate_title_match(resume_title, job.title, resume_skills)

    exp_score = calculate_experience_match(
        resume.experience_years or 0,
        job_requirements,
        job_description,
    )

    resume_location = extract_location_from_content(resume.parsed_content or {})
    location_score = calculate_location_match(resume_location, job.location)

    job_type_score = 100.0

    weighted_score = (
        skill_score * 0.45 +
        title_score * 0.20 +
        exp_score * 0.20 +
        location_score * 0.10 +
        job_type_score * 0.05
    )

    score_boost = 0.0
    if title_score >= 60:
        score_boost += 3.0
    if skill_score >= 60:
        score_boost += 2.0

    final_score = min(weighted_score + score_boost, 100.0)

    return {
        "score": round(final_score, 2),
        "skill_score": round(skill_score, 2),
        "title_score": round(title_score, 2),
        "experience_score": round(exp_score, 2),
        "location_score": round(location_score, 2),
        "matching_skills": skill_result["matching_skills"],
        "missing_skills": skill_result["missing_skills"]
    }


def rank_jobs_for_resume(resume: Resume, jobs: List[Job], min_score: float = 0.0) -> List[Dict]:
    ranked = []
    for job in jobs:
        match_result = calculate_match_score(resume, job)
        if match_result["score"] >= min_score:
            ranked.append({
                "job": job,
                "match_score": match_result["score"],
                "details": match_result
            })

    ranked.sort(key=lambda x: x["match_score"], reverse=True)
    return ranked
