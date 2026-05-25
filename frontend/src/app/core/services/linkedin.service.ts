import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SearchFilterOptions {
  date_posted?: string;
  easy_apply_only?: boolean;
  experience_level?: string[];
  job_type?: string[];
  on_site?: string[];
  sort_by?: string;
  bad_words?: string[];
  about_company_good_words?: string[];
}

export interface PersonalInfo {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  current_city?: string;
  street?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  headline?: string;
  summary?: string;
  cover_letter?: string;
  website?: string;
  linkedin_url?: string;
  experience_years?: string;
  notice_period?: string;
  desired_salary?: string;
  current_ctc?: string;
}

export interface ApplicationQuestions {
  require_visa?: string;
  us_citizenship?: string;
  disability_status?: string;
  veteran_status?: string;
  gender?: string;
  ethnicity?: string;
  security_clearance?: string;
}

export interface SearchConfig {
  search_terms: string[];
  location?: string;
  max_jobs?: number;
  filters?: SearchFilterOptions;
  sources?: string[];
}

export interface ApplyConfig {
  personal_info?: PersonalInfo;
  application_questions?: ApplicationQuestions;
  resume_path?: string | null;
}

export interface SearchRequest {
  search: SearchConfig;
  apply_config?: ApplyConfig;
  resume_id?: string | null;
}

export interface ApplyToJobRequest {
  job_ids: string[];
  apply_config?: ApplyConfig;
  resume_id?: string | null;
}

export interface MatchScore {
  score: number;
  skill_score: number;
  title_score: number;
  experience_score: number;
  matching_skills: string[];
  missing_skills: string[];
}

export interface JobResult {
  id?: string;
  title: string;
  company: string;
  location: string;
  job_link: string;
  external_id: string;
  source: string;
  easy_apply: boolean;
  posted_date: string;
  is_active: boolean;
  match_score?: MatchScore | null;
  skills_required?: string[];
}

export interface JobSearchResponse {
  jobs: JobResult[];
  total_count: number;
  message: string;
  sources_used: string[];
  resume_used?: string | null;
}

export interface ApplyResponse {
  success_count: number;
  failed_jobs: { title: string; company: string; reason: string }[];
  message: string;
  applications_created?: { id: string; job_title: string; company: string; cover_letter_generated: boolean; match_score: number | null }[];
}

export interface SavedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  external_url: string;
  external_id: string;
  source: string;
  job_type: string;
  posted_date: string;
  salary_min: number | null;
  salary_max: number | null;
  is_active: boolean;
}

export interface SavedJobsResponse {
  jobs: SavedJob[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface JobSource {
  id: string;
  label: string;
  requires_api_key: boolean;
}

export interface SourcesResponse {
  sources: JobSource[];
}

@Injectable({
  providedIn: 'root'
})
export class JobSearchService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/job-search';

  /** Search for jobs across free HTTP APIs */
  searchJobs(request: SearchRequest): Observable<JobSearchResponse> {
    return this.http.post<JobSearchResponse>(`${this.apiUrl}/search`, request);
  }

  /** Track applications for selected jobs */
  applyToJobs(request: ApplyToJobRequest): Observable<ApplyResponse> {
    return this.http.post<ApplyResponse>(`${this.apiUrl}/apply`, request);
  }

  /** Get saved jobs from database */
  getSavedJobs(page: number = 1, size: number = 20, source?: string): Observable<SavedJobsResponse> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (source) params = params.set('source', source);
    return this.http.get<SavedJobsResponse>(`${this.apiUrl}/jobs`, { params });
  }

  /** List available job board data sources */
  getSources(): Observable<SourcesResponse> {
    return this.http.get<SourcesResponse>(`${this.apiUrl}/sources`);
  }
}
