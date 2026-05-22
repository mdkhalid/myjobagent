import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AutomationStatus {
  is_running: boolean;
  jobs_queued: number;
  jobs_applied_today: number;
  last_run: string;
}

@Injectable({
  providedIn: 'root'
})
export class AutomationService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/automation';

  getStatus(): Observable<AutomationStatus> {
    return this.http.get<AutomationStatus>(`${this.apiUrl}/status`);
  }

  startAutoApply(settings: {
    min_match_score: number;
    daily_limit: number;
    companies_exclude: string[];
    job_titles_target: string[];
    auto_submit: boolean;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/start`, null, {
      params: {
        min_match_score: settings.min_match_score.toString(),
        daily_limit: settings.daily_limit.toString(),
        auto_submit: settings.auto_submit.toString()
      }
    });
  }

  stopAutoApply(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/stop`, {});
  }

  getApprovalQueue(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/queue`);
  }

  approveApplication(applicationId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/approve/${applicationId}`, {});
  }

  rejectApplication(applicationId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reject/${applicationId}`, {});
  }
}
