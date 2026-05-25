import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  JobSearchService,
  JobResult,
  PersonalInfo,
  SearchFilterOptions,
  JobSource,
} from '../../../core/services/linkedin.service';
import { JobSearchConfigFormComponent } from '../linkedin-config-form/linkedin-config-form.component';
import { JobSearchJobListComponent } from '../linkedin-job-list/linkedin-job-list.component';
import { JobSearchApplyProgressComponent } from '../linkedin-apply-progress/linkedin-apply-progress.component';
import {
  JobSearchResultsSummaryComponent,
  ApplyResult,
} from '../linkedin-results-summary/linkedin-results-summary.component';

@Component({
  selector: 'app-job-search-automation',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    JobSearchConfigFormComponent,
    JobSearchJobListComponent,
    JobSearchApplyProgressComponent,
    JobSearchResultsSummaryComponent,
  ],
  template: `
    <div class="job-search-container">
      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <h1 class="page-title" style="margin-bottom:0"><mat-icon>travel_explore</mat-icon> Job Search & Track</h1>
          <p class="subtitle">Search across multiple free job boards — no browser setup needed</p>
        </div>
        <div class="status-badge online">
          <span class="dot"></span>
          <span>HTTP API — Ready</span>
        </div>
      </div>

      <!-- Info card -->
      <mat-card class="info-card">
        <mat-card-content class="info-content">
          <mat-icon>info</mat-icon>
          <div>
            <strong>No browser automation required</strong>
            <p>Jobs are fetched via free HTTP APIs (RemoteOK, Remotive, Jobicy). Apply by opening the job page in your browser.</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Main content -->
      <app-job-search-config-form
        [searching]="isSearching"
        [sources]="availableSources()"
        (search)="onSearch($event)"
        (reset)="onReset()"
      />

      <!-- Job list (shown after search) -->
      <div class="results-wrapper fade-in" *ngIf="hasSearched">
        <mat-card class="results-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>work</mat-icon>
              Search Results
              <span class="count-badge" *ngIf="jobs.length > 0">{{ jobs.length }}</span>
            </mat-card-title>
            <mat-card-subtitle *ngIf="lastSearchMessage">
              {{ lastSearchMessage }}
              <span *ngIf="sourcesUsed.length > 0"> — Sources: {{ sourcesUsed.join(', ') }}</span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <app-job-search-job-list
              [jobs]="jobs"
              [selectedIds]="selectedJobs"
              [loading]="isSearching"
              [applying]="isApplying"
              [hasSearched]="hasSearched"
              (toggleAll)="toggleAll($event)"
              (toggleJob)="toggleJob($event)"
              (apply)="applyToSelected()"
            />
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Apply overlay -->
      <app-job-search-apply-progress
        [visible]="isApplying"
        [total]="selectedJobs.size"
        [success]="applyResults.success"
        [failed]="applyResults.failed"
        [currentJob]="currentApplyingJob"
      />

      <!-- Results summary -->
      <app-job-search-results-summary
        [visible]="applyFinished"
        [result]="applyResults"
        [totalSelected]="selectedJobs.size"
        (reset)="onReset()"
      />
    </div>
  `,
  styles: [`
    .job-search-container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; }
    .header h1 { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 28px; }
    .header h1 mat-icon { color: var(--primary-light); font-size: 32px; width: 32px; height: 32px; }
    .subtitle { margin: 4px 0 0 44px; color: var(--text-secondary); font-size: 14px; }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(34, 197, 94, 0.1);
      color: var(--success);
      white-space: nowrap;
    }
    .status-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
    .info-card {
      margin-bottom: 24px;
      border-left: 4px solid var(--primary) !important;
      background: rgba(99, 102, 241, 0.06) !important;
    }
    .info-content { display: flex; align-items: flex-start; gap: 12px; }
    .info-content mat-icon { color: var(--primary-light); }
    .info-content strong { color: var(--text); }
    .info-content p { margin: 4px 0 0; color: var(--text-secondary); font-size: 14px; }
    .results-wrapper { margin-top: 24px; }
    .results-card mat-card-title { display: flex; align-items: center; gap: 8px; }
    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 8px;
      border-radius: 12px;
      background: var(--primary);
      color: white;
      font-size: 13px;
      font-weight: 600;
    }
  `],
})
export class JobSearchAutomationComponent implements OnInit {
  private jobSearchService = inject(JobSearchService);
  private snackBar = inject(MatSnackBar);

  // -- State --
  availableSources = signal<JobSource[]>([]);

  isSearching = false;
  isApplying = false;
  applyFinished = false;
  hasSearched = false;

  jobs: JobResult[] = [];
  selectedJobs = new Set<string>();
  lastSearchMessage = '';
  sourcesUsed: string[] = [];

  currentApplyingJob = '';
  applyResults: ApplyResult = { success: 0, failed: 0, failedDetails: [] };

  private searchRequest: any = null;
  private selectedResumeId: string | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.jobSearchService.getSources().subscribe({
      next: (res) => this.availableSources.set(res.sources),
      error: () => this.availableSources.set([
        { id: 'remoteok', label: 'RemoteOK', requires_api_key: false },
        { id: 'remotive', label: 'Remotive', requires_api_key: false },
        { id: 'jobicy', label: 'Jobicy', requires_api_key: false },
      ]),
    });
  }

  // ── Search ───────────────────────────────────────────────────────────────
  onSearch(event: { formData: any; personalInfo: PersonalInfo; filters: SearchFilterOptions }): void {
    this.isSearching = true;
    this.hasSearched = true;
    this.jobs = [];
    this.selectedJobs.clear();
    this.applyFinished = false;
    this.sourcesUsed = [];

    const searchTerms = event.formData.searchTerms.split(',').map((s: string) => s.trim()).filter(Boolean);
    const filters = Object.keys(event.filters).length > 0 ? event.filters : undefined;
    const personalInfo = Object.keys(event.personalInfo).length > 0 ? event.personalInfo : undefined;

    const selectedSources = event.formData.sources && event.formData.sources.length > 0
      ? event.formData.sources : undefined;

    this.searchRequest = {
      search: {
        search_terms: searchTerms,
        location: event.formData.location,
        max_jobs: 25,
        filters,
        sources: selectedSources,
      },
      apply_config: { personal_info: personalInfo, application_questions: undefined, resume_path: null },
      resume_id: event.formData.selectedResume,
    };

    this.selectedResumeId = event.formData.selectedResume;

    this.jobSearchService.searchJobs(this.searchRequest).subscribe({
      next: (res) => {
        this.jobs = res.jobs;
        this.isSearching = false;
        this.lastSearchMessage = res.message;
        this.sourcesUsed = res.sources_used || [];
        const msg = res.jobs.length > 0
          ? `Found ${res.jobs.length} jobs from ${res.sources_used?.length || 0} sources!`
          : res.message || 'No jobs found';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
      error: (err) => {
        this.isSearching = false;
        this.snackBar.open(err.error?.detail || 'Search failed.', 'Close', { duration: 5000 });
      },
    });
  }

  // ── Selection ────────────────────────────────────────────────────────────
  toggleAll(checked: boolean): void {
    this.jobs.forEach(j => {
      if (checked) this.selectedJobs.add(j.external_id);
      else this.selectedJobs.delete(j.external_id);
    });
  }

  toggleJob(jobId: string): void {
    if (this.selectedJobs.has(jobId)) this.selectedJobs.delete(jobId);
    else this.selectedJobs.add(jobId);
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  applyToSelected(): void {
    if (this.selectedJobs.size === 0) return;

    this.isApplying = true;
    this.applyFinished = false;
    this.applyResults = { success: 0, failed: 0, failedDetails: [] };

    const selectedJobs = this.jobs.filter(j => this.selectedJobs.has(j.external_id));
    const jobIds = selectedJobs.map(j => j.id || j.external_id);

    this.currentApplyingJob = '';

    // Show which jobs will get cover letters
    const hasResume = !!this.selectedResumeId;

    this.jobSearchService.applyToJobs({
      job_ids: jobIds,
      apply_config: this.searchRequest?.apply_config || {},
      resume_id: this.selectedResumeId,
    }).subscribe({
      next: (res) => {
        this.applyResults = {
          success: res.success_count,
          failed: res.failed_jobs.length,
          failedDetails: res.failed_jobs,
        };
        this.isApplying = false;
        this.applyFinished = true;

        if (res.applications_created && res.applications_created.length > 0) {
          const withCover = res.applications_created.filter(a => a.cover_letter_generated).length;
          const msg = res.success_count > 0
            ? `Applied to ${res.success_count} jobs! ${withCover > 0 ? `${withCover} with AI-generated cover letters.` : ''}`
            : 'Application process complete.';
          this.snackBar.open(msg, 'Close', { duration: 6000 });
        } else {
          const msg = res.success_count > 0
            ? `Tracked ${res.success_count} applications.`
            : 'Application tracking complete.';
          this.snackBar.open(msg, 'Close', { duration: 5000 });
        }

        // Open job links in browser for manual follow-up
        for (const job of selectedJobs) {
          if (job.job_link) {
            window.open(job.job_link, '_blank');
          }
        }
      },
      error: (err) => {
        this.isApplying = false;
        this.applyFinished = true;
        this.snackBar.open(err.error?.detail || 'Application process failed.', 'Close', { duration: 5000 });
      },
    });
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  onReset(): void {
    this.jobs = [];
    this.selectedJobs.clear();
    this.hasSearched = false;
    this.applyFinished = false;
    this.applyResults = { success: 0, failed: 0, failedDetails: [] };
    this.searchRequest = null;
    this.sourcesUsed = [];
  }
}
