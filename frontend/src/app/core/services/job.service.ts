import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string[];
  skills_required: string[];
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  job_type: string;
  source: string;
  external_url: string;
  posted_date: string;
}

export interface JobMatch {
  job: Job;
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
}

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/jobs/';

  getJobs(params?: any): Observable<any> {
    return this.http.get<any>(this.apiUrl, { params });
  }

  searchJobs(params: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}search`, { params });
  }

  matchJobs(resumeId?: string, minScore: number = 0, limit: number = 100): Observable<JobMatch[]> {
    let httpParams = new HttpParams();
    if (resumeId) httpParams = httpParams.set('resume_id', resumeId);
    httpParams = httpParams.set('min_score', minScore.toString());
    httpParams = httpParams.set('limit', limit.toString());
    
    return this.http.post<JobMatch[]>(`${this.apiUrl}match`, {}, { params: httpParams });
  }

  scrapeJobs(keywords: string, location?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}scrape`, null, {
      params: { keywords, ...(location && { location }) }
    });
  }

  getSkillGap(resumeId?: string, minScore: number = 0, limit: number = 50): Observable<SkillGapResult> {
    let params = new HttpParams();
    if (resumeId) params = params.set('resume_id', resumeId);
    params = params.set('min_score', minScore.toString());
    params = params.set('limit', limit.toString());
    return this.http.get<SkillGapResult>(`${this.apiUrl}skill-gap`, { params });
  }

  getJobSkillGap(jobId: string, resumeId?: string): Observable<JobSkillGapResult> {
    let params = new HttpParams();
    if (resumeId) params = params.set('resume_id', resumeId);
    return this.http.get<JobSkillGapResult>(`${this.apiUrl}${jobId}/skill-gap`, { params });
  }
}

export interface LearningResource {
  name: string;
  url: string;
  platform: string;
}

export interface MissingSkillAnalysis {
  skill: string;
  frequency: number;
  in_percent_of_jobs: number;
  learning_resources: LearningResource[];
}

export interface JobBreakdownItem {
  job_id: string;
  job_title: string;
  company: string;
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
}

export interface SkillGapResult {
  my_skills: string[];
  skill_match_percentage: number;
  analyzed_jobs: number;
  total_skills_required: number;
  skills_i_have: string[];
  missing_skills: MissingSkillAnalysis[];
  job_breakdown: JobBreakdownItem[];
}

export interface JobSkillGapMissingSkill {
  skill: string;
  learning_resources: LearningResource[];
}

export interface ScoreBreakdown {
  skill_score: number;
  title_score: number;
  experience_score: number;
  location_score: number;
}

export interface JobSkillGapResult {
  job_id: string;
  job_title: string;
  company: string;
  match_score: number;
  my_skills: string[];
  matching_skills: string[];
  missing_skills: JobSkillGapMissingSkill[];
  score_breakdown: ScoreBreakdown;
}
