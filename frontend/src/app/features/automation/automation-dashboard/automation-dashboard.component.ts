import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AutomationService, AutomationStatus } from '../../../core/services/automation.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-automation-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatInputModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="container">
      <h1>
        <mat-icon>auto_mode</mat-icon>
        Auto-Apply
      </h1>

      <!-- Status Card -->
      <mat-card class="status-card" [class.running]="status?.is_running">
        <mat-card-content>
          <div class="status-indicator">
            <div class="status-dot" [ngClass]="status?.is_running ? 'active' : 'inactive'"></div>
            <div class="status-text">
              <h2>{{ status?.is_running ? 'Auto-Apply is Running' : 'Auto-Apply is Stopped' }}</h2>
              <p *ngIf="status?.last_run">Last run: {{ status?.last_run | date:'medium' }}</p>
            </div>
          </div>
          
          <div class="status-stats" *ngIf="status?.is_running">
            <div class="stat">
              <span class="value">{{ status?.jobs_queued || 0 }}</span>
              <span class="label">Jobs Queued</span>
            </div>
            <div class="stat">
              <span class="value">{{ status?.jobs_applied_today || 0 }}</span>
              <span class="label">Applied Today</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Controls -->
      <div class="controls-row">
        <button 
          mat-raised-button 
          [color]="status?.is_running ? 'warn' : 'primary'"
          (click)="toggleAutomation()"
          [disabled]="isLoading">
          <mat-icon>{{ status?.is_running ? 'stop' : 'play_arrow' }}</mat-icon>
          {{ status?.is_running ? 'Stop Auto-Apply' : 'Start Auto-Apply' }}
        </button>
      </div>

      <!-- Settings -->
      <mat-card class="settings-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>settings</mat-icon>
            Automation Settings
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="settingsForm">
            <div class="setting-row">
              <label>Minimum Match Score: {{ settingsForm.value.min_match_score }}%</label>
              <mat-slider min="0" max="100" step="5">
                <input matSliderThumb formControlName="min_match_score">
              </mat-slider>
            </div>

            <div class="setting-row">
              <label>Daily Application Limit: {{ settingsForm.value.daily_limit }}</label>
              <mat-slider min="1" max="50" step="1">
                <input matSliderThumb formControlName="daily_limit">
              </mat-slider>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Companies to Exclude (comma-separated)</mat-label>
              <input matInput formControlName="companies_exclude" placeholder="e.g., Company A, Company B">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Target Job Titles (comma-separated)</mat-label>
              <input matInput formControlName="job_titles_target" placeholder="e.g., Software Engineer, Developer">
            </mat-form-field>

            <mat-slide-toggle formControlName="auto_submit" color="primary">
              Auto-submit applications (without approval)
            </mat-slide-toggle>
            <p class="hint" *ngIf="settingsForm.value.auto_submit">
              <mat-icon>warning</mat-icon>
              Warning: This will submit applications automatically without your review
            </p>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Approval Queue -->
      <mat-card class="queue-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>queue</mat-icon>
            Approval Queue
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="approvalQueue.length === 0" class="empty-queue">
            <mat-icon>check_circle</mat-icon>
            <p>No jobs waiting for approval</p>
          </div>

          <div *ngIf="approvalQueue.length > 0" class="queue-list">
            <div *ngFor="let item of approvalQueue" class="queue-item">
              <div class="job-info">
                <div class="job-title">{{ item.job.title }}</div>
                <div class="company">{{ item.job.company }}</div>
              </div>
              <div class="match-score" [ngClass]="getScoreClass(item.match_score)">
                {{ item.match_score | number:'1.0-0' }}%
              </div>
              <div class="actions">
                <button mat-icon-button color="primary" (click)="approve(item.application_id)">
                  <mat-icon>check</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="reject(item.application_id)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
    }

    .status-card {
      margin-bottom: 24px;
      transition: border-color 0.3s;

      &.running {
        border: 2px solid #4caf50;
      }

      mat-card-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 24px;
      }
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 16px;

      .status-dot {
        width: 20px;
        height: 20px;
        border-radius: 50%;

        &.active {
          background-color: #4caf50;
          box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.3);
          animation: pulse 2s infinite;
        }

        &.inactive {
          background-color: #9e9e9e;
        }
      }

      h2 {
        margin: 0;
        font-size: 20px;
      }

      p {
        margin: 4px 0 0;
        color: #666;
        font-size: 14px;
      }
    }

    .status-stats {
      display: flex;
      gap: 32px;

      .stat {
        text-align: center;

        .value {
          display: block;
          font-size: 32px;
          font-weight: 600;
          color: #1976d2;
        }

        .label {
          font-size: 14px;
          color: #666;
        }
      }
    }

    .controls-row {
      margin-bottom: 24px;

      button {
        height: 48px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        padding: 0 32px;
      }
    }

    .settings-card {
      margin-bottom: 24px;

      mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .setting-row {
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }

        mat-slider {
          width: 100%;
        }
      }

      .hint {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        color: #f44336;
        font-size: 14px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    .queue-card {
      mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .empty-queue {
      text-align: center;
      padding: 40px;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #4caf50;
      }

      p {
        margin-top: 16px;
        color: #666;
      }
    }

    .queue-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .queue-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;

      .job-info {
        flex: 1;

        .job-title {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .company {
          font-size: 14px;
          color: #666;
        }
      }

      .match-score {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;

        &.high {
          background-color: #4caf50;
          color: white;
        }

        &.medium {
          background-color: #ff9800;
          color: white;
        }

        &.low {
          background-color: #f44336;
          color: white;
        }
      }

      .actions {
        display: flex;
        gap: 8px;
      }
    }

    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
      }
    }
  `]
})
export class AutomationDashboardComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private automationService = inject(AutomationService);
  private snackBar = inject(MatSnackBar);

  status: AutomationStatus | null = null;
  approvalQueue: any[] = [];
  isLoading = false;
  settingsForm: FormGroup;
  private statusSubscription?: Subscription;

  constructor() {
    this.settingsForm = this.fb.group({
      min_match_score: [70],
      daily_limit: [10],
      companies_exclude: [''],
      job_titles_target: [''],
      auto_submit: [false]
    });
  }

  ngOnInit(): void {
    this.loadStatus();
    this.loadApprovalQueue();
    
    // Refresh status every 10 seconds
    this.statusSubscription = interval(10000).subscribe(() => {
      if (this.status?.is_running) {
        this.loadStatus();
        this.loadApprovalQueue();
      }
    });
  }

  ngOnDestroy(): void {
    this.statusSubscription?.unsubscribe();
  }

  loadStatus(): void {
    this.automationService.getStatus().subscribe({
      next: (status) => {
        this.status = status;
      }
    });
  }

  loadApprovalQueue(): void {
    this.automationService.getApprovalQueue().subscribe({
      next: (queue) => {
        this.approvalQueue = queue;
      }
    });
  }

  toggleAutomation(): void {
    if (this.status?.is_running) {
      this.stopAutomation();
    } else {
      this.startAutomation();
    }
  }

  startAutomation(): void {
    this.isLoading = true;
    const settings = {
      min_match_score: this.settingsForm.value.min_match_score,
      daily_limit: this.settingsForm.value.daily_limit,
      companies_exclude: this.parseList(this.settingsForm.value.companies_exclude),
      job_titles_target: this.parseList(this.settingsForm.value.job_titles_target),
      auto_submit: this.settingsForm.value.auto_submit
    };

    this.automationService.startAutoApply(settings).subscribe({
      next: () => {
        this.snackBar.open('Auto-apply started!', 'Close', { duration: 3000 });
        this.loadStatus();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  stopAutomation(): void {
    this.automationService.stopAutoApply().subscribe({
      next: () => {
        this.snackBar.open('Auto-apply stopped', 'Close', { duration: 3000 });
        this.loadStatus();
      }
    });
  }

  approve(applicationId: string): void {
    this.automationService.approveApplication(applicationId).subscribe({
      next: () => {
        this.snackBar.open('Application approved!', 'Close', { duration: 3000 });
        this.loadApprovalQueue();
      }
    });
  }

  reject(applicationId: string): void {
    this.automationService.rejectApplication(applicationId).subscribe({
      next: () => {
        this.snackBar.open('Application rejected', 'Close', { duration: 3000 });
        this.loadApprovalQueue();
      }
    });
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  private parseList(value: string): string[] {
    return value.split(',').map(s => s.trim()).filter(s => s);
  }
}
