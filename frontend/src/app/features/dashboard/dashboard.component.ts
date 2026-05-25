import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { ApplicationService } from '../../core/services/application.service';
import { AutomationService } from '../../core/services/automation.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    RouterLink
  ],
  template: `
    <div class="container">
      <h1 class="page-title">Dashboard</h1>
      
      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!isLoading" class="dashboard-grid fade-in">
        <!-- Stats Cards -->
        <div class="stats-row">
          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon blue">
                <mat-icon>assignment</mat-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats?.total || 0 }}</div>
                <div class="stat-label">Total Applications</div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon purple">
                <mat-icon>schedule</mat-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats?.pending || 0 }}</div>
                <div class="stat-label">Pending</div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon green">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats?.applied || 0 }}</div>
                <div class="stat-label">Applied</div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon orange">
                <mat-icon>event</mat-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats?.interview || 0 }}</div>
                <div class="stat-label">Interviews</div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon success">
                <mat-icon>stars</mat-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats?.offer || 0 }}</div>
                <div class="stat-label">Offers</div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Recent Applications -->
        <mat-card class="recent-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>history</mat-icon>
              Recent Applications
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="recentApplications.length === 0" class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>No applications yet. Start by searching for jobs!</p>
              <button mat-raised-button color="primary" routerLink="/jobs">
                <mat-icon>search</mat-icon>
                Search Jobs
              </button>
            </div>
            
            <div *ngIf="recentApplications.length > 0" class="application-list">
              <div *ngFor="let app of recentApplications" class="application-item">
                <div class="app-info">
                  <div class="job-title">{{ app.job_title }}</div>
                  <div class="company">{{ app.company }}</div>
                </div>
                <div class="app-meta">
                  <span class="status-badge" [ngClass]="app.status">{{ app.status }}</span>
                </div>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions *ngIf="recentApplications.length > 0">
            <button mat-button color="primary" routerLink="/applications">
              View All Applications
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- Quick Actions -->
        <mat-card class="actions-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>flash_on</mat-icon>
              Quick Actions
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="action-buttons">
              <button mat-raised-button color="primary" routerLink="/resumes">
                <mat-icon>upload</mat-icon>
                Upload Resume
              </button>
              <button mat-raised-button color="accent" routerLink="/jobs">
                <mat-icon>search</mat-icon>
                Find Jobs
              </button>
              <button mat-raised-button color="warn" routerLink="/automation">
                <mat-icon>auto_mode</mat-icon>
                Auto-Apply
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .page-title {
      margin-bottom: 24px;
      font-size: 30px;
      font-weight: 700;
    }

    .dashboard-grid {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }

    .stat-card {
      mat-card-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
      }
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.blue { background: rgba(99, 102, 241, 0.12); color: var(--primary-light); }
      &.purple { background: rgba(168, 85, 247, 0.12); color: #c084fc; }
      &.green { background: rgba(34, 197, 94, 0.12); color: var(--success); }
      &.orange { background: rgba(245, 158, 11, 0.12); color: var(--warning); }
      &.success { background: rgba(34, 197, 94, 0.12); color: var(--success); }

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    .stat-info {
      flex: 1;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      color: var(--text);
    }

    .stat-label {
      font-size: 14px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .recent-card {
      mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .empty-state {
      text-align: center;
      padding: 40px;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--text-muted);
      }

      p {
        margin: 16px 0;
        color: var(--text-secondary);
      }
    }

    .application-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .application-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-radius: var(--radius-md);
      background: rgba(148, 163, 184, 0.04);
      border: 1px solid var(--border);
      transition: all var(--transition);

      &:hover {
        background: rgba(148, 163, 184, 0.08);
        border-color: var(--border-light);
      }

      .job-title {
        font-weight: 500;
        margin-bottom: 2px;
        color: var(--text);
      }

      .company {
        font-size: 13px;
        color: var(--text-secondary);
      }

      .app-meta {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }

    .actions-card {
      mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;

      button {
        flex: 1;
        min-width: 150px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private applicationService = inject(ApplicationService);

  stats: any = null;
  recentApplications: any[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.applicationService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    this.applicationService.getApplications().subscribe({
      next: (applications) => {
        this.recentApplications = applications.slice(0, 5);
      }
    });
  }
}
