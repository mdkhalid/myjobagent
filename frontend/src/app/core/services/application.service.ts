import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Application {
  id: string;
  job_id: string;
  resume_id: string;
  status: string;
  applied_date: string;
  notes: string;
  match_score: number;
  auto_applied: boolean;
  cover_letter: string;
  created_at: string;
  updated_at: string;
  job?: {
    title: string;
    company: string;
    location: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/applications/';

  getApplications(status?: string): Observable<Application[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Application[]>(this.apiUrl, { params });
  }

  createApplication(jobId: string, resumeId?: string, generateCoverLetter: boolean = false, submitNow: boolean = false): Observable<Application> {
    let params = new HttpParams();
    if (generateCoverLetter) params = params.set('generate_cover_letter', 'true');
    if (submitNow) params = params.set('submit_now', 'true');
    return this.http.post<Application>(this.apiUrl, {
      job_id: jobId,
      resume_id: resumeId
    }, { params });
  }

  updateStatus(applicationId: string, status: string, notes?: string): Observable<Application> {
    return this.http.put<Application>(`${this.apiUrl}${applicationId}/status`, {
      status,
      notes
    });
  }

  deleteApplication(applicationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${applicationId}`);
  }

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}stats/summary`);
  }
}
