import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TrackingStats {
  total_applications: number;
  recent_applications: number;
  by_status: Record<string, number>;
  upcoming_interviews: number;
  conversion_rates: {
    application_to_interview: number;
    interview_to_offer: number;
    application_to_offer: number;
  };
}

export interface TimelineEntry {
  date: string;
  job_title: string;
  company: string;
  status: string;
  match_score: number | null;
}

export interface Interview {
  id: string;
  type: string;
  scheduled_date: string;
  company: string;
  job_title: string;
}

export interface DashboardData {
  stats: TrackingStats;
  upcoming_interviews: Interview[];
  recent_applications: {
    id: string;
    job_title: string;
    company: string;
    status: string;
    applied_date: string | null;
    match_score: number | null;
  }[];
}

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private http = inject(HttpClient);
  private baseUrl = '/api/v1/tracking';

  getStats(days: number = 30): Observable<TrackingStats> {
    return this.http.get<TrackingStats>(`${this.baseUrl}/stats`, {
      params: { days: days.toString() },
    });
  }

  getTimeline(days: number = 90): Observable<TimelineEntry[]> {
    return this.http.get<TimelineEntry[]>(`${this.baseUrl}/timeline`, {
      params: { days: days.toString() },
    });
  }

  getInterviews(upcomingOnly: boolean = false): Observable<Interview[]> {
    let params = new HttpParams();
    if (upcomingOnly) params = params.set('upcoming_only', 'true');
    return this.http.get<Interview[]>(`${this.baseUrl}/interviews`, { params });
  }

  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.baseUrl}/dashboard`);
  }
}
