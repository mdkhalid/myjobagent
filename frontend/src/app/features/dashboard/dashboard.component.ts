import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { timer, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService, DashboardData, CompanyDashboard, AdminDashboard, JobseekerDashboard } from '../../core/services/dashboard.service';
import { JobseekerDashboardComponent } from './jobseeker-dashboard.component';
import { CompanyDashboardComponent } from './company-dashboard.component';
import { AdminDashboardComponent } from './admin-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    JobseekerDashboardComponent,
    CompanyDashboardComponent,
    AdminDashboardComponent,
  ],
  template: `
    <div class="container">
      <!-- Loading state — either waiting for role or loading dashboard data -->
      <div *ngIf="isLoading || isWaitingForRole" class="loading-container">
        <div class="loading-content">
          <mat-spinner diameter="48"></mat-spinner>
          <p class="loading-text">{{ isWaitingForRole ? 'Loading your profile...' : 'Loading dashboard...' }}</p>
          <span class="loading-hint" *ngIf="isWaitingForRole">Just a moment while we grab your account</span>
        </div>
      </div>

      <div *ngIf="error" class="error-state">
        <mat-icon>error</mat-icon>
        <p>{{ error }}</p>
        <button mat-stroked-button (click)="retry()">Retry</button>
      </div>

      <!-- Jobseeker Dashboard -->
      <app-jobseeker-dashboard
        *ngIf="!isLoading && !error && role === 'jobseeker'"
        [data]="jobseekerData"
      />

      <!-- Company Dashboard -->
      <app-company-dashboard
        *ngIf="!isLoading && !error && role === 'company'"
        [data]="companyData"
        (createJob)="onCreateJob()"
        (editJob)="onEditJob($event)"
        (viewJob)="onViewJob($event)"
        (viewApplicants)="onViewApplicants($event)"
      />

      <!-- Admin Dashboard -->
      <app-admin-dashboard
        *ngIf="!isLoading && !error && role === 'admin'"
        [data]="adminData"
        (manageUsers)="onManageUsers()"
      />
    </div>
  `,
  styles: [`
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
    .loading-container { display: flex; justify-content: center; align-items: center; min-height: 400px; }
    .loading-content { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .loading-text { font-size: 16px; color: var(--text-secondary); margin: 0; }
    .loading-hint { font-size: 13px; color: var(--text-muted); animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    .error-state {
      text-align: center; padding: 60px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--warn); }
      p { margin: 12px 0; color: var(--text-secondary); }
    }
  `],
})
export class DashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = true;
  isWaitingForRole = false;
  error: string | null = null;
  dashboardData: DashboardData | null = null;
  role: string | null = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.init();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private init(): void {
    // Reset state
    this.error = null;
    this.dashboardData = null;
    this.role = null;
    this.isLoading = true;
    this.isWaitingForRole = false;

    // Try immediate role check first (fast path when already loaded)
    this.role = this.authService.getUserRole();
    if (this.role) {
      this.loadDashboard();
      return;
    }

    // Role not loaded yet — show loading state while we wait
    this.isWaitingForRole = true;

    // Wait for the auth service to load the current user
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          if (user) {
            this.role = user.role;
            this.isWaitingForRole = false;
            this.loadDashboard();
          }
        },
      });

    // Timeout safeguard — show error if role never loads (15s)
    timer(15000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.role && !this.error) {
          this.isWaitingForRole = false;
          this.isLoading = false;
          this.error = 'Unable to determine user role. Please try logging in again.';
        }
      });
  }

  retry(): void {
    this.destroy$.next(); // cancel old subscriptions
    this.destroy$ = new Subject<void>(); // create fresh subject
    this.init();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.error = null;
    this.dashboardService.getDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.detail || 'Failed to load dashboard data';
      },
    });
  }

  // ── Typed getters for child components ───────────────────────────

  get jobseekerData(): JobseekerDashboard | null {
    return this.role === 'jobseeker' ? (this.dashboardData as JobseekerDashboard) : null;
  }

  get companyData(): CompanyDashboard | null {
    return this.role === 'company' ? (this.dashboardData as CompanyDashboard) : null;
  }

  get adminData(): AdminDashboard | null {
    return this.role === 'admin' ? (this.dashboardData as AdminDashboard) : null;
  }

  // ── Company actions ──────────────────────────────────────────────

  onCreateJob(): void {
    // Navigate to a job posting form — for now, go to the jobs page
    this.router.navigate(['/jobs']);
  }

  onEditJob(jobId: string): void {
    // Navigate to job edit — for now, go to the jobs page
    this.router.navigate(['/jobs']);
  }

  onViewJob(jobId: string): void {
    // Navigate to job detail — for now, go to applications
    this.router.navigate(['/applications']);
  }

  onViewApplicants(jobId: string): void {
    // Navigate to a filtered view of applicants
    this.router.navigate(['/applications']);
  }

  // ── Admin actions ────────────────────────────────────────────────

  onManageUsers(): void {
    this.router.navigate(['/admin/users']);
  }
}
