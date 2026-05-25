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
}
