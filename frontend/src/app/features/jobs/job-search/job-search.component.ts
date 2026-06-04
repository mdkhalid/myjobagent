import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { JobService, Job, JobMatch, JobSkillGapResult } from '../../../core/services/job.service';
import { ApplicationService } from '../../../core/services/application.service';

@Component({
  selector: 'app-job-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatPaginatorModule
  ],
  template: `
    <div class="container">
      <h1 class="page-title">Find Jobs</h1>

      <!-- Search Form -->
      <mat-card class="search-card">
        <mat-card-content>
          <form [formGroup]="searchForm" (ngSubmit)="searchJobs()">
            <div class="search-row">
              <mat-form-field appearance="outline" class="keywords-field">
                <mat-label>Keywords</mat-label>
                <input matInput formControlName="keywords" placeholder="e.g. software engineer, react, python">
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="location-field">
                <mat-label>Location</mat-label>
                <input matInput formControlName="location" placeholder="City, state, or remote">
                <mat-icon matPrefix>location_on</mat-icon>
              </mat-form-field>

              <button 
                mat-raised-button 
                color="primary" 
                type="submit"
                [disabled]="isSearching"
                class="search-btn">
                <mat-icon *ngIf="!isSearching">search</mat-icon>
                <mat-spinner *ngIf="isSearching" diameter="20"></mat-spinner>
                {{ isSearching ? 'Searching...' : 'Search' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Action Buttons -->
      <div class="actions-row">
        <button 
          mat-raised-button
          (click)="scrapeJobs()"
          [disabled]="isScraping"
          class="scrape-btn">
          <mat-icon>cloud_download</mat-icon>
          {{ isScraping ? 'Scraping...' : 'Scrape Jobs' }}
        </button>
        <button 
          mat-raised-button 
          color="accent"
          (click)="matchJobs()"
          [disabled]="isMatching">
          <mat-icon>psychology</mat-icon>
          {{ isMatching ? 'Matching...' : 'Match to My Resume' }}
        </button>
      </div>

      <!-- Loading Skeleton -->
      <div *ngIf="isLoading" class="skeleton-list">
        <div class="skeleton-card" *ngFor="let _ of [1,2,3]">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-subtitle"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-chips"></div>
        </div>
      </div>

      <!-- Results -->
      <div *ngIf="!isLoading && jobs.length > 0" class="results-section fade-in">
        <div class="results-header">
          <h2>
            Found <span class="highlight">{{ totalItems }}</span> job{{ totalItems === 1 ? '' : 's' }}
            <span class="page-info" *ngIf="totalPages > 1"> — Page {{ currentPage }} of {{ totalPages }}</span>
          </h2>
        </div>

        <div class="job-list">
          <mat-card *ngFor="let jobMatch of jobs; let i = index" class="job-card">
            <mat-card-header>
              <mat-card-title>{{ jobMatch.job.title }}</mat-card-title>
              <mat-card-subtitle>
                <span class="company-info">
                  <mat-icon>business</mat-icon> {{ jobMatch.job.company }}
                </span>
                <span class="separator"></span>
                <span class="location-info">
                  <mat-icon>location_on</mat-icon> {{ jobMatch.job.location || 'Remote' }}
                </span>
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <div class="match-info" *ngIf="jobMatch.match_score !== undefined">
                <div class="match-score-ring" [ngClass]="getScoreClass(jobMatch.match_score)">
                  <svg width="56" height="56" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="3"/>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--score-color)" stroke-width="3"
                      stroke-dasharray="97.4"
                      [attr.stroke-dashoffset]="97.4 - (97.4 * jobMatch.match_score / 100)"
                      stroke-linecap="round"
                      style="transition: stroke-dashoffset 0.6s ease"/>
                  </svg>
                  <span class="score-text">{{ jobMatch.match_score | number:'1.0-0' }}%</span>
                </div>
                <div class="match-details">
                  <span class="match-label">Match Score</span>
                  <span class="skills-match" *ngIf="jobMatch.matching_skills?.length">
                    {{ jobMatch.matching_skills.length }} matching skills
                  </span>
                  <span class="skills-match" *ngIf="!jobMatch.matching_skills?.length">
                    Based on your resume
                  </span>
                </div>
              </div>

              <p class="description">{{ jobMatch.job.description | slice:0:200 }}...</p>

              <div class="skills-section">
                <span class="chip" *ngFor="let skill of jobMatch.job.skills_required?.slice(0, 6)" 
                      [class.matched]="isMatchingSkill(skill, jobMatch)">
                  {{ skill }}
                </span>
              </div>

              <div class="job-meta">
                <span class="meta-item" *ngIf="jobMatch.job.salary_min">
                  <mat-icon>attach_money</mat-icon>
                  {{ '$' + (jobMatch.job.salary_min | number) + ' - $' + (jobMatch.job.salary_max | number) }}
                </span>
                <span class="meta-item">
                  <mat-icon>schedule</mat-icon>
                  {{ jobMatch.job.job_type }}
                </span>
                <span class="meta-item" *ngIf="jobMatch.job.posted_date">
                  <mat-icon>calendar_today</mat-icon>
                  {{ jobMatch.job.posted_date | date:'mediumDate' }}
                </span>
              </div>
            </mat-card-content>

            <mat-card-actions>
              <a mat-button color="primary" [href]="jobMatch.job.external_url" target="_blank">
                <mat-icon>open_in_new</mat-icon>
                View Job
              </a>
              <button 
                mat-stroked-button
                color="primary"
                (click)="viewJobSkillGap(jobMatch.job.id)"
                [disabled]="isAnalyzingJobGap.get(jobMatch.job.id)"
                class="skill-gap-job-btn">
                <mat-icon *ngIf="!isAnalyzingJobGap.get(jobMatch.job.id) && !jobSkillGaps.get(jobMatch.job.id)">insights</mat-icon>
                <mat-spinner *ngIf="isAnalyzingJobGap.get(jobMatch.job.id)" diameter="16"></mat-spinner>
                <mat-icon *ngIf="!isAnalyzingJobGap.get(jobMatch.job.id) && jobSkillGaps.get(jobMatch.job.id)">expand_less</mat-icon>
                {{ isAnalyzingJobGap.get(jobMatch.job.id) ? '' : (jobSkillGaps.get(jobMatch.job.id) ? 'Hide Analysis' : 'Skill Gap') }}
              </button>
              <button 
                mat-raised-button 
                color="accent" 
                (click)="applyToJob(jobMatch.job)"
                [disabled]="appliedJobs.has(jobMatch.job.id)">
                <mat-icon>send</mat-icon>
                {{ appliedJobs.has(jobMatch.job.id) ? 'Applied' : 'Apply' }}
              </button>
            </mat-card-actions>

            <!-- Per-Job Skill Gap Analysis Panel -->
            <div *ngIf="jobSkillGaps.get(jobMatch.job.id)" class="job-skill-gap-panel fade-in">
              <div class="gap-header">
                <div class="gap-score" [ngClass]="getScoreClass(jobSkillGaps.get(jobMatch.job.id)!.match_score)">
                  <span class="gap-score-value">{{ jobSkillGaps.get(jobMatch.job.id)!.match_score | number:'1.0-0' }}%</span>
                  <span class="gap-score-label">Match</span>
                </div>
              </div>

              <div class="gap-section">
                <div class="gap-section-title">
                  <mat-icon class="match-icon">check_circle</mat-icon>
                  Matching Skills
                  <span class="gap-count">{{ jobSkillGaps.get(jobMatch.job.id)!.matching_skills.length }}</span>
                </div>
                <div class="gap-chips" *ngIf="jobSkillGaps.get(jobMatch.job.id)!.matching_skills.length">
                  <span class="gap-chip match" *ngFor="let s of jobSkillGaps.get(jobMatch.job.id)!.matching_skills">{{ s }}</span>
                </div>
                <div class="gap-empty" *ngIf="!jobSkillGaps.get(jobMatch.job.id)!.matching_skills.length">
                  No direct skill matches — your experience may still apply
                </div>
              </div>

              <div class="gap-section">
                <div class="gap-section-title">
                  <mat-icon class="miss-icon">pending</mat-icon>
                  Missing Skills
                  <span class="gap-count warn">{{ jobSkillGaps.get(jobMatch.job.id)!.missing_skills.length }}</span>
                </div>
                <div class="missing-list-compact">
                  <div class="missing-item-compact" *ngFor="let ms of jobSkillGaps.get(jobMatch.job.id)!.missing_skills">
                    <div class="missing-skill-header">
                      <span class="missing-skill-name">{{ ms.skill }}</span>
                    </div>
                    <div class="resources-mini" *ngIf="ms.learning_resources?.length">
                      <span class="resource-mini" *ngFor="let r of ms.learning_resources.slice(0, 2)">
                        <a [href]="r.url" target="_blank" rel="noopener" class="resource-link">
                          {{ r.name | slice:0:40 }}{{ r.name.length > 40 ? '...' : '' }}
                          <span class="res-platform" [ngClass]="platformClass(r.platform)">{{ r.platform }}</span>
                        </a>
                      </span>
                      <span *ngIf="ms.learning_resources.length > 2" class="more-resources">
                        +{{ ms.learning_resources.length - 2 }} more
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-card>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar" *ngIf="totalPages > 1">
          <button mat-stroked-button [disabled]="currentPage <= 1" (click)="goToPage(currentPage - 1)">
            <mat-icon>chevron_left</mat-icon> Previous
          </button>
          <div class="page-numbers">
            <button *ngFor="let p of pageNumbers" 
                    mat-stroked-button 
                    [class.active]="p === currentPage"
                    (click)="goToPage(p)"
                    class="page-btn">
              {{ p }}
            </button>
          </div>
          <button mat-stroked-button [disabled]="currentPage >= totalPages" (click)="goToPage(currentPage + 1)">
            Next <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && hasSearched && jobs.length === 0" class="empty-state">
        <mat-icon>search_off</mat-icon>
        <h2>No jobs found</h2>
        <p>Try different keywords or scrape fresh jobs to get started</p>
        <button mat-stroked-button (click)="scrapeJobs()" [disabled]="isScraping">
          <mat-icon>refresh</mat-icon> Scrape Fresh Jobs
        </button>
      </div>
    </div>
  `,
  styles: [`
    .search-card {
      margin-bottom: 20px;
      border: 1px solid var(--border) !important;
    }

    .search-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;

      .keywords-field {
        flex: 2;
        min-width: 240px;
      }

      .location-field {
        flex: 1;
        min-width: 200px;
      }

      .search-btn {
        height: 56px;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 130px;
      }
    }

    .actions-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

.scrape-btn {
      background: linear-gradient(135deg, #059669, #10b981) !important;
      color: white !important;
      border: none !important;
      box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3) !important;
      transition: all var(--transition) !important;
      &:hover {
        box-shadow: 0 4px 16px rgba(5, 150, 105, 0.4) !important;
        transform: translateY(-1px);
      }
      &:disabled { opacity: 0.6; }
    }

    .skill-gap-job-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      mat-spinner { margin: 0 4px; }
    }

    .job-skill-gap-panel {
      border-top: 1px solid var(--border);
      padding: 16px;
      background: rgba(148,163,184,0.03);
      display: flex;
      flex-direction: column;
      gap: 14px;

      .gap-header {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .gap-score {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 10px;
        font-weight: 700;
        &.high { background: rgba(34,197,94,0.1); color: var(--success); }
        &.medium { background: rgba(245,158,11,0.1); color: var(--warning); }
        &.low { background: rgba(239,68,68,0.1); color: var(--warn); }
        .gap-score-value { font-size: 18px; }
        .gap-score-label { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.04em; }
      }

      .gap-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .gap-section-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        .match-icon { color: var(--success); }
        .miss-icon { color: var(--warning); }
      }
      .gap-count {
        font-size: 11px;
        font-weight: 700;
        background: rgba(34,197,94,0.1);
        color: var(--success);
        padding: 1px 7px;
        border-radius: 8px;
        &.warn { background: rgba(245,158,11,0.1); color: var(--warning); }
      }

      .gap-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .gap-chip {
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        border: 1px solid transparent;
        &.match {
          background: rgba(34,197,94,0.08);
          color: var(--success);
          border-color: rgba(34,197,94,0.15);
        }
        &.miss {
          background: rgba(245,158,11,0.08);
          color: var(--warning);
          border-color: rgba(245,158,11,0.15);
        }
      }
      .gap-empty {
        font-size: 12px;
        color: var(--text-muted);
        font-style: italic;
        padding: 4px 0;
      }

      .missing-list-compact {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .missing-item-compact {
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        background: rgba(148,163,184,0.04);
        border: 1px solid var(--border);
      }
      .missing-skill-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .missing-skill-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }
      .resources-mini {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }
      .resource-mini {
        font-size: 11px;
      }
      .resource-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 6px;
        background: rgba(99,102,241,0.06);
        color: var(--text);
        text-decoration: none;
        transition: all var(--transition);
        font-size: 11px;
        &:hover { background: rgba(99,102,241,0.1); color: var(--primary-light); }
      }
      .res-platform {
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        text-transform: uppercase;
        &.free { background: rgba(34,197,94,0.1); color: var(--success); }
        &.paid, &.udemy, &.coursera, &.book { background: rgba(99,102,241,0.1); color: var(--primary-light); }
      }
      .more-resources {
        font-size: 11px;
        color: var(--text-muted);
        font-style: italic;
        align-self: center;
      }
    }

    .skeleton-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .skeleton-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-title {
      width: 60%;
      height: 20px;
    }
    .skeleton-subtitle {
      width: 40%;
      height: 14px;
    }
    .skeleton-text {
      width: 90%;
      height: 12px;
    }
    .skeleton-chips {
      width: 50%;
      height: 28px;
    }

    .results-section {
      animation: fadeInUp 0.3s ease-out;
    }

    .results-header {
      margin-bottom: 16px;

      h2 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .highlight {
        color: var(--text);
        font-weight: 700;
      }
    }

    .job-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .job-card {
      cursor: default;
      border: 1px solid var(--border) !important;
      transition: all var(--transition);
    }

    .job-card:hover {
      border-color: var(--primary) !important;
      box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15), var(--shadow-lg) !important;
      transform: translateY(-2px);
    }

    mat-card-subtitle {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }

      .separator {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--text-muted);
        opacity: 0.4;
      }
    }

    .match-info {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 14px;
      padding: 14px;
      background: rgba(99, 102, 241, 0.04);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);

      .match-score-ring {
        &.high { --score-color: var(--success); }
        &.medium { --score-color: var(--warning); }
        &.low { --score-color: var(--warn); }
      }

      .score-text {
        color: var(--text);
        font-size: 13px;
      }

      .match-details {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .match-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .skills-match {
          font-size: 14px;
          color: var(--success);
          font-weight: 500;
        }
      }
    }

    .description {
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 14px;
    }

    .skills-section {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      background: rgba(148, 163, 184, 0.1);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      transition: all var(--transition);

      &.matched {
        background: rgba(34, 197, 94, 0.1);
        color: var(--success);
        border-color: rgba(34, 197, 94, 0.2);
      }
    }

    .job-meta {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        color: var(--text-muted);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 0 16px 14px !important;
    }

    .pagination-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      padding: 20px 0 8px;
      flex-wrap: wrap;
    }

    .page-numbers {
      display: flex;
      gap: 4px;
    }

    .page-btn {
      min-width: 36px;
      padding: 0 8px;
      height: 36px;
      font-size: 13px;
      font-weight: 500;
    }

    .page-btn.active {
      background: var(--primary) !important;
      color: white !important;
      border-color: var(--primary) !important;
    }

    .page-info {
      font-size: 14px;
      font-weight: 400;
      color: var(--text-muted);
    }
  `]
})
export class JobSearchComponent implements OnInit {
  private fb = inject(FormBuilder);
  private jobService = inject(JobService);
  private applicationService = inject(ApplicationService);
  private snackBar = inject(MatSnackBar);

  searchForm: FormGroup = this.fb.group({
    keywords: [''],
    location: ['']
  });

  jobs: JobMatch[] = [];
  appliedJobs = new Set<string>();
  isLoading = false;
  isSearching = false;
  isMatching = false;
  isScraping = false;
  isAnalyzingJobGap = new Map<string, boolean>();
  jobSkillGaps = new Map<string, JobSkillGapResult>();
  hasSearched = false;

  paginated = false;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  pageSize = 20;

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  ngOnInit(): void {
    this.loadJobs();
    this.loadAppliedJobs();
  }

  private setPaginatedResponse(response: any): void {
    if (response && typeof response === 'object' && 'items' in response) {
      this.totalItems = response.total || 0;
      this.currentPage = response.page || 1;
      this.totalPages = response.pages || 1;
      this.paginated = true;
      const raw = response.items || [];
      this.jobs = raw.filter((j: Job) => j.source !== 'mock').map((job: Job) => ({ job, match_score: 0, matching_skills: [], missing_skills: [] })) || [];
    } else if (Array.isArray(response)) {
      this.jobs = response.filter((j: Job) => j.source !== 'mock').map((job: Job) => ({ job, match_score: 0, matching_skills: [], missing_skills: [] })) || [];
      this.totalItems = this.jobs.length;
      this.totalPages = 1;
      this.currentPage = 1;
      this.paginated = false;
    }
  }

  loadJobs(): void {
    this.isLoading = true;
    this.jobService.getJobs({ page: this.currentPage, limit: this.pageSize }).subscribe({
      next: (response) => {
        this.setPaginatedResponse(response);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadAppliedJobs(): void {
    this.applicationService.getApplications().subscribe({
      next: (apps) => {
        this.appliedJobs = new Set(apps.map(a => a.job_id));
      },
      error: () => {}
    });
  }

  searchJobs(): void {
    this.isSearching = true;
    this.hasSearched = true;
    this.currentPage = 1;
    
    const { keywords, location } = this.searchForm.value;
    
    this.jobService.searchJobs({
      keywords, location,
      page: this.currentPage,
      page_size: this.pageSize,
    }).subscribe({
      next: (response) => {
        this.setPaginatedResponse(response);
        this.isSearching = false;
        if (this.jobs.length === 0) {
          this.snackBar.open('No jobs found. Try different keywords or scrape new jobs.', 'Close', { duration: 5000 });
        }
      },
      error: (err) => {
        this.isSearching = false;
        this.snackBar.open(err.error?.detail || 'Search failed', 'Close', { duration: 5000 });
      }
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadJobs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  matchJobs(): void {
    this.isMatching = true;
    this.hasSearched = true;
    
    this.jobService.matchJobs(undefined, 50).subscribe({
      next: (matches) => {
        this.jobs = matches;
        this.totalItems = matches.length;
        this.totalPages = 1;
        this.paginated = false;
        this.isMatching = false;
      },
      error: (err) => {
        this.isMatching = false;
        const message = err.error?.detail || err.message || 'Failed to match jobs';
        this.snackBar.open(message, 'Close', { duration: 5000 });
      }
    });
  }

  scrapeJobs(): void {
    this.isScraping = true;
    const { keywords, location } = this.searchForm.value;
    
    this.jobService.scrapeJobs(keywords || 'software', location || 'remote').subscribe({
      next: (response) => {
        this.snackBar.open(response.message || 'Jobs scraped successfully!', 'Close', { duration: 3000 });
        this.isScraping = false;
        this.currentPage = 1;
        this.loadJobs();
      },
      error: () => {
        this.isScraping = false;
      }
    });
  }

  applyToJob(job: Job): void {
    this.applicationService.createApplication(job.id, undefined, true, true).subscribe({
      next: () => {
        this.appliedJobs.add(job.id);
        this.snackBar.open('Application submitted! Opening job page...', 'Close', { duration: 3000 });
        if (job.external_url) {
          window.open(job.external_url, '_blank');
        }
      },
      error: (err) => {
        const message = err.error?.detail || err.message || 'Failed to create application';
        this.snackBar.open(message, 'Close', { duration: 5000 });
      }
    });
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  isMatchingSkill(skill: string, jobMatch: JobMatch): boolean {
    return jobMatch.matching_skills?.includes(skill) || false;
  }

  viewJobSkillGap(jobId: string): void {
    // Toggle off if already showing
    if (this.jobSkillGaps.has(jobId)) {
      this.jobSkillGaps.delete(jobId);
      return;
    }

    this.isAnalyzingJobGap.set(jobId, true);

    this.jobService.getJobSkillGap(jobId).subscribe({
      next: (result) => {
        this.jobSkillGaps.set(jobId, result);
        this.isAnalyzingJobGap.set(jobId, false);
      },
      error: (err) => {
        this.isAnalyzingJobGap.set(jobId, false);
        const message = err.error?.detail || err.message || 'Failed to analyze skill gap';
        this.snackBar.open(message, 'Close', { duration: 5000 });
      }
    });
  }

  platformClass(platform: string): string {
    if (!platform) return 'free';
    return platform.toLowerCase().replace(/[^a-z]/g, '');
  }
}
