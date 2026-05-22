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
import { MatSnackBar } from '@angular/material/snack-bar';
import { JobService, Job, JobMatch } from '../../../core/services/job.service';
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
    MatProgressSpinnerModule
  ],
  template: `
    <div class="container">
      <h1>Find Jobs</h1>

      <!-- Search Form -->
      <mat-card class="search-card">
        <mat-card-content>
          <form [formGroup]="searchForm" (ngSubmit)="searchJobs()">
            <div class="search-row">
              <mat-form-field appearance="outline" class="keywords-field">
                <mat-label>Keywords</mat-label>
                <input matInput formControlName="keywords" placeholder="Job title, skills, or company">
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
                [disabled]="isSearching">
                <mat-icon *ngIf="!isSearching">search</mat-icon>
                <mat-spinner *ngIf="isSearching" diameter="20"></mat-spinner>
                {{ isSearching ? 'Searching...' : 'Search' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Scrape Jobs Button -->
      <div class="scrape-section">
        <button 
          mat-raised-button 
          color="accent" 
          (click)="scrapeJobs()"
          [disabled]="isScraping">
          <mat-icon>refresh</mat-icon>
          {{ isScraping ? 'Scraping...' : 'Scrape Fresh Jobs' }}
        </button>
      </div>

      <!-- Match Jobs Button -->
      <div class="match-section">
        <button 
          mat-raised-button 
          color="accent" 
          (click)="matchJobs()"
          [disabled]="isMatching">
          <mat-icon>psychology</mat-icon>
          {{ isMatching ? 'Matching...' : 'Match Jobs to My Resume' }}
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner></mat-spinner>
      </div>

      <!-- Results -->
      <div *ngIf="!isLoading && jobs.length > 0" class="results-section">
        <h2>Found {{ jobs.length }} jobs</h2>
        
        <div class="job-list">
          <mat-card *ngFor="let jobMatch of jobs" class="job-card">
            <mat-card-header>
              <mat-card-title>{{ jobMatch.job.title }}</mat-card-title>
              <mat-card-subtitle>
                <mat-icon>business</mat-icon> {{ jobMatch.job.company }}
                <span class="separator">|</span>
                <mat-icon>location_on</mat-icon> {{ jobMatch.job.location || 'Remote' }}
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <div class="match-info" *ngIf="jobMatch.match_score !== undefined">
                <div class="match-score" [ngClass]="getScoreClass(jobMatch.match_score)">
                  {{ jobMatch.match_score | number:'1.0-0' }}%
                </div>
                <div class="match-details">
                  <span class="match-label">Match Score</span>
                  <span class="skills-match" *ngIf="jobMatch.matching_skills?.length">
                    {{ jobMatch.matching_skills.length }} matching skills
                  </span>
                </div>
              </div>

              <p class="description">{{ jobMatch.job.description | slice:0:200 }}...</p>

              <div class="skills-section">
                <mat-chip-set>
                  <mat-chip *ngFor="let skill of jobMatch.job.skills_required?.slice(0, 6)" 
                           [highlighted]="isMatchingSkill(skill, jobMatch)">
                    {{ skill }}
                  </mat-chip>
                </mat-chip-set>
              </div>

              <div class="job-meta">
                <span *ngIf="jobMatch.job.salary_min">
                  <mat-icon>attach_money</mat-icon>
                  {{ '$' + (jobMatch.job.salary_min | number) + ' - $' + (jobMatch.job.salary_max | number) }}
                </span>
                <span>
                  <mat-icon>schedule</mat-icon>
                  {{ jobMatch.job.job_type }}
                </span>
                <span *ngIf="jobMatch.job.posted_date">
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
                mat-raised-button 
                color="accent" 
                (click)="applyToJob(jobMatch.job)"
                [disabled]="appliedJobs.has(jobMatch.job.id)">
                <mat-icon>send</mat-icon>
                {{ appliedJobs.has(jobMatch.job.id) ? 'Applied' : 'Apply' }}
              </button>
            </mat-card-actions>
          </mat-card>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && hasSearched && jobs.length === 0" class="empty-state">
        <mat-icon>search_off</mat-icon>
        <h2>No jobs found</h2>
        <p>Try adjusting your search criteria</p>
      </div>
    </div>
  `,
  styles: [`
    h1 {
      margin-bottom: 24px;
    }

    .search-card {
      margin-bottom: 24px;
    }

    .search-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;

      .keywords-field {
        flex: 2;
        min-width: 250px;
      }

      .location-field {
        flex: 1;
        min-width: 200px;
      }

      button {
        height: 56px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .scrape-section {
      text-align: center;
      margin-bottom: 24px;

      button {
        height: 48px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    }

    .match-section {
      text-align: center;
      margin-bottom: 24px;

      button {
        height: 48px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    }

    .results-section {
      h2 {
        margin-bottom: 16px;
      }
    }

    .job-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .job-card {
      mat-card-subtitle {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        .separator {
          color: #ccc;
        }
      }
    }

    .match-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px;
      background-color: #f5f5f5;
      border-radius: 8px;

      .match-score {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 600;

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

      .match-details {
        display: flex;
        flex-direction: column;

        .match-label {
          font-size: 12px;
          color: #666;
        }

        .skills-match {
          font-size: 14px;
          color: #4caf50;
        }
      }
    }

    .description {
      color: #666;
      margin-bottom: 16px;
    }

    .skills-section {
      margin-bottom: 16px;

      mat-chip {
        font-size: 12px;
      }
    }

    .job-meta {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 14px;
      color: #666;

      span {
        display: flex;
        align-items: center;
        gap: 4px;

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
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;

      mat-icon {
        font-size: 80px;
        width: 80px;
        height: 80px;
        color: #ccc;
      }

      h2 {
        margin: 16px 0 8px;
      }

      p {
        color: #666;
      }
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
  hasSearched = false;

  ngOnInit(): void {
    this.loadJobs();
    this.loadAppliedJobs();
  }

  loadJobs(): void {
    this.isLoading = true;
    this.jobService.getJobs({ limit: 20 }).subscribe({
      next: (response) => {
        const jobsList = Array.isArray(response) ? response : response.items;
        this.jobs = jobsList?.filter((j: Job) => j.source !== 'mock').map((job: Job) => ({ job, match_score: 0 })) || [];
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
    
    const { keywords, location } = this.searchForm.value;
    
    this.jobService.searchJobs({ keywords, location }).subscribe({
      next: (response) => {
        this.jobs = response.items?.filter((j: Job) => j.source !== 'mock').map((job: Job) => ({ job, match_score: 0 })) || [];
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

  matchJobs(): void {
    this.isMatching = true;
    this.hasSearched = true;
    
    this.jobService.matchJobs(undefined, 50).subscribe({
      next: (matches) => {
        this.jobs = matches;
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
        // Reload jobs after scraping
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
}
