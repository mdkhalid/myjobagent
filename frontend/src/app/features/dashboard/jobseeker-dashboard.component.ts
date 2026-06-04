import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { JobseekerDashboard, JobseekerStats } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-jobseeker-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule, RouterLink],
  template: `
    <div class="dashboard-grid fade-in">
      <!-- Welcome -->
      <div class="welcome-card">
        <div class="welcome-text">
          <h2>Your Job Search Dashboard</h2>
          <p *ngIf="data()?.has_resume === false" class="welcome-hint">
            <mat-icon>info</mat-icon>
            Upload a resume to get AI-powered job matching
          </p>
        </div>
        <div class="welcome-actions">
          <button mat-raised-button color="primary" routerLink="/jobs">
            <mat-icon>search</mat-icon> Find Jobs
          </button>
          <button mat-stroked-button routerLink="/resumes" *ngIf="!data()?.has_resume">
            <mat-icon>upload</mat-icon> Upload Resume
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-row">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon total"><mat-icon>assignment</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().total_applications }}</div>
              <div class="stat-label">Total Applications</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon pending"><mat-icon>schedule</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().pending }}</div>
              <div class="stat-label">Pending</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon applied"><mat-icon>check_circle</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().applied }}</div>
              <div class="stat-label">Applied</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon interviews"><mat-icon>event</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().interviews }}</div>
              <div class="stat-label">Interviews</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon offers"><mat-icon>stars</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().offers }}</div>
              <div class="stat-label">Offers</div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="dashboard-columns">
        <!-- Recent Applications -->
        <mat-card class="recent-card">
          <mat-card-header>
            <mat-card-title><mat-icon>history</mat-icon> Recent Applications</mat-card-title>
            <a mat-button color="primary" routerLink="/applications" *ngIf="(data()?.recent_applications?.length || 0) > 0">View All</a>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="!data()?.recent_applications?.length" class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>No applications yet. Start by searching for jobs!</p>
              <button mat-raised-button color="primary" routerLink="/jobs"><mat-icon>search</mat-icon> Search Jobs</button>
            </div>
            <div *ngIf="data()?.recent_applications?.length" class="app-list">
              <div *ngFor="let app of data()?.recent_applications" class="app-item">
                <div class="app-info">
                  <div class="app-title">{{ app.job_title }}</div>
                  <div class="app-company">{{ app.company }}</div>
                </div>
                <div class="app-meta">
                  <span class="status-badge" [ngClass]="app.status">{{ app.status }}</span>
                  <span class="match-chip" *ngIf="app.match_score">{{ app.match_score | number:'1.0-0' }}%</span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Upcoming Interviews -->
        <mat-card class="interviews-card">
          <mat-card-header>
            <mat-card-title><mat-icon>event</mat-icon> Upcoming Interviews</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="!data()?.upcoming_interviews?.length" class="empty-state compact">
              <mat-icon>event_busy</mat-icon>
              <p>No upcoming interviews</p>
            </div>
            <div *ngIf="data()?.upcoming_interviews?.length" class="interview-list">
              <div *ngFor="let iv of data()?.upcoming_interviews" class="interview-item">
                <div class="interview-icon"><mat-icon>video_call</mat-icon></div>
                <div class="interview-info">
                  <div class="interview-company">{{ iv.company }}</div>
                  <div class="interview-role">{{ iv.job_title }}</div>
                  <div class="interview-date">{{ iv.scheduled_date | date:'MMM d, h:mm a' }}</div>
                </div>
                <span class="interview-type">{{ iv.type }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Quick Actions -->
      <mat-card class="actions-card">
        <mat-card-header>
          <mat-card-title><mat-icon>flash_on</mat-icon> Quick Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="action-buttons">
            <button mat-raised-button color="primary" routerLink="/search">
              <mat-icon>travel_explore</mat-icon> Multi-Source Search
            </button>
            <button mat-raised-button color="accent" routerLink="/automation">
              <mat-icon>auto_mode</mat-icon> Auto-Apply
            </button>
            <button mat-raised-button routerLink="/analytics">
              <mat-icon>insights</mat-icon> Analytics
            </button>
            <button mat-stroked-button routerLink="/resumes">
              <mat-icon>description</mat-icon> Manage Resumes
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-grid { display: flex; flex-direction: column; gap: 24px; }
    .dashboard-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

    .welcome-card {
      display: flex; justify-content: space-between; align-items: center;
      padding: 24px; background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.06));
      border: 1px solid var(--border); border-radius: var(--radius-lg); flex-wrap: wrap; gap: 16px;
    }
    .welcome-text h2 { margin: 0; font-size: 20px; font-weight: 700; color: var(--text); }
    .welcome-hint { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 14px; color: var(--warning); }
    .welcome-hint mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .welcome-actions { display: flex; gap: 12px; }

    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
    .stat-card mat-card-content { display: flex; align-items: center; gap: 14px; padding: 18px; }
    .stat-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .stat-icon.total { background: rgba(99,102,241,0.12); color: var(--primary-light); }
    .stat-icon.pending { background: rgba(245,158,11,0.12); color: var(--warning); }
    .stat-icon.applied { background: rgba(99,102,241,0.12); color: var(--primary-light); }
    .stat-icon.interviews { background: rgba(6,182,212,0.12); color: var(--accent); }
    .stat-icon.offers { background: rgba(34,197,94,0.12); color: var(--success); }
    .stat-info { flex: 1; }
    .stat-value { font-size: 28px; font-weight: 700; line-height: 1; color: var(--text); }
    .stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

    .recent-card, .interviews-card {
      mat-card-header { display: flex; justify-content: space-between; align-items: center; }
      mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 16px !important; }
    }
    .empty-state { text-align: center; padding: 32px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--text-muted); }
    .empty-state p { margin: 12px 0; color: var(--text-secondary); }
    .empty-state.compact { padding: 24px; }
    .empty-state.compact mat-icon { font-size: 36px; width: 36px; height: 36px; }

    .app-list { display: flex; flex-direction: column; gap: 6px; }
    .app-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 14px; border-radius: var(--radius-md);
      background: rgba(148,163,184,0.04); border: 1px solid var(--border);
      transition: all var(--transition);
      &:hover { background: rgba(148,163,184,0.08); border-color: var(--border-light); }
    }
    .app-title { font-weight: 500; margin-bottom: 2px; color: var(--text); font-size: 14px; }
    .app-company { font-size: 12px; color: var(--text-secondary); }
    .app-meta { display: flex; align-items: center; gap: 8px; }
    .match-chip {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      background: rgba(34,197,94,0.1); color: var(--success);
    }

    .interview-list { display: flex; flex-direction: column; gap: 8px; }
    .interview-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px; border-radius: var(--radius-md);
      background: rgba(148,163,184,0.04); border: 1px solid var(--border);
    }
    .interview-icon mat-icon { color: var(--accent); }
    .interview-info { flex: 1; }
    .interview-company { font-weight: 600; font-size: 14px; color: var(--text); }
    .interview-role { font-size: 12px; color: var(--text-secondary); }
    .interview-date { font-size: 12px; color: var(--primary-light); margin-top: 2px; }
    .interview-type {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      padding: 2px 10px; border-radius: 10px;
      background: rgba(6,182,212,0.1); color: var(--accent);
    }

    .actions-card mat-card-title { display: flex; align-items: center; gap: 8px; }
    .action-buttons { display: flex; flex-wrap: wrap; gap: 12px; }
    .action-buttons button { flex: 1; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 8px; }

    @media (max-width: 768px) { .dashboard-columns { grid-template-columns: 1fr; } }
  `],
})
export class JobseekerDashboardComponent {
  readonly data = input<JobseekerDashboard | null>(null);

  stats(): JobseekerStats {
    return this.data()?.stats || {
      total_applications: 0, by_status: {}, pending: 0, applied: 0, interviews: 0, offers: 0,
    };
  }
}
