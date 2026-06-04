import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CompanyDashboard } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-company-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule, MatProgressSpinnerModule],
  template: `
    <div class="dashboard-grid fade-in">
      <!-- Welcome -->
      <div class="welcome-card">
        <div class="welcome-text">
          <h2><mat-icon>business</mat-icon> {{ data()?.company_name || 'Company Dashboard' }}</h2>
          <p>Manage your job postings and review applicants</p>
        </div>
        <div class="welcome-actions">
          <button mat-raised-button color="primary" (click)="createJob.emit()">
            <mat-icon>add</mat-icon> Post a Job
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-row">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon blue"><mat-icon>work</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().total_jobs }}</div>
              <div class="stat-label">Total Jobs Posted</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon green"><mat-icon>check_circle</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().active_jobs }}</div>
              <div class="stat-label">Active Listings</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon purple"><mat-icon>people</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().total_applicants }}</div>
              <div class="stat-label">Total Applicants</div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Recent Job Postings -->
      <mat-card class="jobs-card">
        <mat-card-header>
          <mat-card-title><mat-icon>work_history</mat-icon> Recent Job Postings</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="!data()?.recent_jobs?.length" class="empty-state">
            <mat-icon>work_off</mat-icon>
            <h3>No jobs posted yet</h3>
            <p>Create your first job posting to start receiving applications</p>
            <button mat-raised-button color="primary" (click)="createJob.emit()">
              <mat-icon>add</mat-icon> Post a Job
            </button>
          </div>
          <div *ngIf="data()?.recent_jobs?.length" class="job-list">
            <div *ngFor="let job of data()?.recent_jobs" class="job-item" (click)="viewJob.emit(job.id)">
              <div class="job-header">
                <div class="job-title">{{ job.title }}</div>
                <span class="status-dot" [class.active]="job.is_active" [class.inactive]="!job.is_active">
                  {{ job.is_active ? 'Active' : 'Closed' }}
                </span>
              </div>
              <div class="job-meta">
                <span *ngIf="job.location"><mat-icon>location_on</mat-icon> {{ job.location }}</span>
                <span *ngIf="job.applicant_count > 0"><mat-icon>people</mat-icon> {{ job.applicant_count }} applicant{{ job.applicant_count === 1 ? '' : 's' }}</span>
                <span *ngIf="!job.applicant_count"><mat-icon>person_add</mat-icon> No applicants yet</span>
                <span *ngIf="job.posted_date"><mat-icon>calendar_today</mat-icon> {{ job.posted_date | date:'mediumDate' }}</span>
              </div>
              <div class="job-actions">
                <button mat-button color="primary" (click)="$event.stopPropagation(); viewApplicants.emit(job.id)">
                  <mat-icon>people</mat-icon> View Applicants
                </button>
                <button mat-button (click)="$event.stopPropagation(); editJob.emit(job.id)">
                  <mat-icon>edit</mat-icon> Edit
                </button>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Quick Actions -->
      <mat-card class="actions-card">
        <mat-card-header>
          <mat-card-title><mat-icon>flash_on</mat-icon> Quick Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="action-buttons">
            <button mat-raised-button color="primary" (click)="createJob.emit()">
              <mat-icon>post_add</mat-icon> Post New Job
            </button>
            <button mat-raised-button color="accent" routerLink="/analytics">
              <mat-icon>insights</mat-icon> Analytics
            </button>
            <button mat-stroked-button routerLink="/search">
              <mat-icon>search</mat-icon> Browse Candidates
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-grid { display: flex; flex-direction: column; gap: 24px; }

    .welcome-card {
      display: flex; justify-content: space-between; align-items: center;
      padding: 24px; background: linear-gradient(135deg, rgba(34,197,94,0.06), rgba(99,102,241,0.06));
      border: 1px solid var(--border); border-radius: var(--radius-lg); flex-wrap: wrap; gap: 16px;
    }
    .welcome-text h2 { margin: 0; font-size: 20px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 10px; }
    .welcome-text p { margin: 4px 0 0; color: var(--text-secondary); font-size: 14px; }
    .welcome-actions { display: flex; gap: 12px; }

    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .stat-card mat-card-content { display: flex; align-items: center; gap: 14px; padding: 18px; }
    .stat-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .stat-icon.blue { background: rgba(99,102,241,0.12); color: var(--primary-light); }
    .stat-icon.green { background: rgba(34,197,94,0.12); color: var(--success); }
    .stat-icon.purple { background: rgba(168,85,247,0.12); color: #c084fc; }
    .stat-info { flex: 1; }
    .stat-value { font-size: 28px; font-weight: 700; line-height: 1; color: var(--text); }
    .stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

    .jobs-card mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 16px !important; }
    .empty-state { text-align: center; padding: 40px; }
    .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; color: var(--text-muted); }
    .empty-state h3 { margin: 12px 0 4px; color: var(--text); }
    .empty-state p { color: var(--text-secondary); margin-bottom: 16px; }

    .job-list { display: flex; flex-direction: column; gap: 8px; }
    .job-item {
      padding: 16px; border-radius: var(--radius-md);
      background: rgba(148,163,184,0.04); border: 1px solid var(--border);
      cursor: pointer; transition: all var(--transition);
      &:hover { background: rgba(148,163,184,0.08); border-color: var(--primary); }
    }
    .job-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .job-title { font-weight: 600; font-size: 15px; color: var(--text); }
    .status-dot {
      font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 10px;
      &.active { background: rgba(34,197,94,0.1); color: var(--success); }
      &.inactive { background: rgba(148,163,184,0.1); color: var(--text-muted); }
    }
    .job-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; font-size: 13px; color: var(--text-secondary); }
    .job-meta span { display: flex; align-items: center; gap: 4px; }
    .job-meta mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .job-actions { display: flex; gap: 8px; }

    .actions-card mat-card-title { display: flex; align-items: center; gap: 8px; }
    .action-buttons { display: flex; flex-wrap: wrap; gap: 12px; }
    .action-buttons button { flex: 1; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 8px; }

    @media (max-width: 768px) { .stats-row { grid-template-columns: 1fr 1fr; } }
  `],
})
export class CompanyDashboardComponent {
  readonly data = input<CompanyDashboard | null>(null);
  readonly createJob = output<void>();
  readonly editJob = output<string>();
  readonly viewJob = output<string>();
  readonly viewApplicants = output<string>();

  stats() {
    return this.data()?.stats || { total_jobs: 0, active_jobs: 0, total_applicants: 0 };
  }
}
