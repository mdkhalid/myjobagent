import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Resume {
  id: string;
  filename: string;
  file_path: string;
  parsed_content: any;
  skills: string[];
  experience_years: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Suggestion {
  id: string;
  section: string;
  original_text: string;
  suggested_text: string;
  reason: string;
  type: string;
}

export interface AtsCategoryScores {
  keywords: number;
  formatting: number;
  experience: number;
  education: number;
  skills: number;
}

export interface AtsScore {
  overall: number;
  categories: AtsCategoryScores;
  strengths: string[];
  improvements: string[];
  missing_keywords: string[];
}

export interface TailorRequest {
  job_title: string;
  job_description: string;
  job_skills?: string[];
}

export interface TailorResponse {
  suggestions: Suggestion[];
  ats_score: AtsScore;
}

export interface AtsScoreResponse {
  ats_score: AtsScore;
}

export interface VariantInfo {
  id: string;
  label: string;
  description: string;
  tailored_text: string;
  ats_score: AtsScore;
}

export interface TailorVariantsResponse {
  variants: VariantInfo[];
}

@Injectable({
  providedIn: 'root'
})
export class ResumeService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/resumes/';

  getResumes(): Observable<Resume[]> {
    return this.http.get<Resume[]>(this.apiUrl);
  }

  uploadResume(file: File): Observable<Resume> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Resume>(`${this.apiUrl}upload`, formData);
  }

  deleteResume(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}`);
  }

  setActiveResume(id: string): Observable<Resume> {
    return this.http.post<Resume>(`${this.apiUrl}${id}/set-active`, {});
  }

  getParsedResume(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}${id}/parsed`);
  }

  tailorResume(id: string, request: TailorRequest): Observable<TailorResponse> {
    const apiUrl = '/api/v1/tailor/';
    return this.http.post<TailorResponse>(`${apiUrl}tailor?resume_id=${id}`, request);
  }

  getAtsScore(id: string, request: TailorRequest): Observable<AtsScoreResponse> {
    const apiUrl = '/api/v1/tailor/';
    return this.http.post<AtsScoreResponse>(`${apiUrl}ats-score?resume_id=${id}`, request);
  }

  saveTailored(id: string, tailoredText: string, jobTitle: string, rawTextSnapshot: string, variantId?: string): Observable<any> {
    const apiUrl = '/api/v1/tailor/';
    const body: any = { tailored_text: tailoredText, job_title: jobTitle, raw_text_snapshot: rawTextSnapshot };
    if (variantId) body.variant_id = variantId;
    return this.http.post<any>(
      `${apiUrl}save-tailored?resume_id=${id}`,
      body
    );
  }

  getTailoredVersion(id: string, versionIndex: number): Observable<any> {
    return this.http.get<any>(`/api/v1/tailor/${id}/tailored/${versionIndex}`);
  }

  getTailorVariants(id: string, request: TailorRequest): Observable<TailorVariantsResponse> {
    const apiUrl = '/api/v1/tailor/';
    return this.http.post<TailorVariantsResponse>(`${apiUrl}variants?resume_id=${id}`, request);
  }

  downloadTailored(id: string, versionIndex: number, fmt: string = 'pdf', template: string = 'professional', useOriginal: boolean = false): string {
    let url = `/api/v1/tailor/${id}/tailored/${versionIndex}/download?fmt=${fmt}&template=${template}`;
    if (useOriginal) {
      url += `&use_original=true`;
    }
    return url;
  }
}
