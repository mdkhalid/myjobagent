import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface JobseekerStats {
  total_applications: number;
  by_status: Record<string, number>;
  pending: number;
  applied: number;
  interviews: number;
  offers: number;
}

export interface JobseekerDashboard {
  role: 'jobseeker';
  stats: JobseekerStats;
  recent_applications: {
    id: string;
    job_title: string;
    company: string;
    status: string;
    applied_date: string | null;
    match_score: number | null;
  }[];
  upcoming_interviews: {
    id: string;
    type: string;
    scheduled_date: string;
    company: string;
    job_title: string;
  }[];
  has_resume: boolean;
}

export interface CompanyDashboard {
  role: 'company';
  stats: {
    total_jobs: number;
    active_jobs: number;
    total_applicants: number;
  };
  company_name: string;
  recent_jobs: {
    id: string;
    title: string;
    location: string | null;
    is_active: boolean;
    posted_date: string | null;
    applicant_count: number;
  }[];
}

export interface AdminDashboard {
  role: 'admin';
  stats: {
    total_users: number;
    total_jobs: number;
    total_applications: number;
    users_by_role: Record<string, number>;
  };
}

export type DashboardData = JobseekerDashboard | CompanyDashboard | AdminDashboard;

export interface PlatformStats {
  users: {
    total: number;
    jobseekers: number;
    companies: number;
    admins: number;
    active: number;
    new_this_week: number;
  };
  jobs: {
    total: number;
    company_posted: number;
    scraped: number;
    active: number;
  };
  applications: {
    total: number;
    today: number;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  company_name?: string;
  created_at: string;
  updated_at: string;
}

export interface RecentActivity {
  recent_users: { id: string; name: string; email: string; role: string; created_at: string }[];
  recent_applications: { id: string; job_title: string; company: string; applicant: string; status: string; created_at: string }[];
  recent_jobs: { id: string; title: string; company: string; source: string; created_at: string }[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private baseUrl = '/api/v1/dashboard';

  /** Get role-specific dashboard data */
  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.baseUrl}/`);
  }

  /** Admin: get platform stats */
  getAdminStats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>('/api/v1/admin/dashboard');
  }

  /** Admin: get all users */
  getAdminUsers(params?: {
    role?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>('/api/v1/admin/users', { params: params as any });
  }

  /** Admin: toggle user active status */
  toggleUserActive(userId: string): Observable<any> {
    return this.http.post(`/api/v1/admin/users/${userId}/toggle-active`, {});
  }

  /** Admin: get recent activity */
  getRecentActivity(limit: number = 20): Observable<RecentActivity> {
    return this.http.get<RecentActivity>('/api/v1/admin/activity/recent', {
      params: { limit: limit.toString() },
    });
  }
}
