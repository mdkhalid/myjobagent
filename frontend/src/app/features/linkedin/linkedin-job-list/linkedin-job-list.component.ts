import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JobResult } from '../../../core/services/linkedin.service';

@Component({
  selector: 'app-job-search-job-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatTooltipModule],
  template: `
    <mat-card class="job-card" [class.selected]="selected()" (click)="toggle.emit()">
      <mat-card-header>
        <mat-checkbox [checked]="selected()" (click)="$event.stopPropagation()"
                      (change)="toggle.emit()"></mat-checkbox>
        <div class="job-header-content">
          <mat-card-title>
            {{ job().title }}
            <span class="match-badge" *ngIf="job().match_score" [class.high]="job().match_score!.score >= 80"
                  [class.medium]="job().match_score!.score >= 60 && job().match_score!.score < 80"
                  [class.low]="job().match_score!.score < 60" matTooltip="Match score against your resume">
              {{ job().match_score!.score | number:'1.0-0' }}%
            </span>
          </mat-card-title>
          <mat-card-subtitle>
            <span class="company"><mat-icon>business</mat-icon> {{ job().company }}</span>
            <span class="separator"></span>
            <span class="location"><mat-icon>location_on</mat-icon> {{ job().location || 'Remote' }}</span>
          </mat-card-subtitle>
          <div class="skills-match" *ngIf="job().match_score">
            <div class="match-bar-track">
              <div class="match-bar-fill" [style.width.%]="job().match_score!.score"
                   [class.high]="job().match_score!.score >= 80"
                   [class.medium]="job().match_score!.score >= 60 && job().match_score!.score < 80"
                   [class.low]="job().match_score!.score < 60"></div>
            </div>
            <div class="match-details" *ngIf="job().match_score">
              <span class="match-detail" matTooltip="Skills match">
                <mat-icon>check_circle</mat-icon> {{ (job().match_score!.matching_skills || []).length }} matched
              </span>
              <span class="match-detail missing" *ngIf="(job().match_score!.missing_skills || []).length > 0" matTooltip="Missing skills: {{ (job().match_score!.missing_skills || []).join(', ') }}">
                <mat-icon>arrow_circle_right</mat-icon> {{ (job().match_score!.missing_skills || []).length }} missing
              </span>
            </div>
          </div>
        </div>
        <div class="job-badges">
          <span class="badge source-badge" [matTooltip]="'Source: ' + job().source">
            <mat-icon>dns</mat-icon> {{ job().source }}
          </span>
          <span class="badge easy-apply" *ngIf="job().easy_apply" matTooltip="Easy Apply available">
            <mat-icon>bolt</mat-icon> Easy Apply
          </span>
        </div>
      </mat-card-header>
      <mat-card-actions>
        <a mat-button [href]="job().job_link" target="_blank" (click)="$event.stopPropagation()">
          <mat-icon>open_in_new</mat-icon> Open Job Page
        </a>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .job-card {
      cursor: pointer;
      border: 1px solid var(--border) !important;
      transition: all var(--transition);
    }
    .job-card:hover {
      border-color: var(--primary) !important;
      box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15), var(--shadow-lg) !important;
      transform: translateY(-2px);
    }
    .job-card.selected {
      border-color: var(--primary) !important;
      background: rgba(99, 102, 241, 0.06) !important;
    }
    mat-card-header { display: flex; align-items: flex-start; gap: 12px; }
    mat-card-header mat-checkbox { margin-top: 4px; }
    .job-header-content { flex: 1; min-width: 0; }
    .job-header-content mat-card-title {
      font-size: 16px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .match-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 24px;
      padding: 0 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
    }
    .match-badge.high { background: rgba(34, 197, 94, 0.12); color: var(--success); }
    .match-badge.medium { background: rgba(245, 158, 11, 0.12); color: var(--warning); }
    .match-badge.low { background: rgba(239, 68, 68, 0.12); color: var(--warn); }
    .job-header-content mat-card-subtitle { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .job-header-content mat-card-subtitle mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .separator { width: 4px; height: 4px; border-radius: 50%; background: var(--text-muted); opacity: 0.4; }
    .skills-match { margin-top: 8px; }
    .match-bar-track { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; max-width: 200px; }
    .match-bar-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
    .match-bar-fill.high { background: var(--success); }
    .match-bar-fill.medium { background: var(--warning); }
    .match-bar-fill.low { background: var(--warn); }
    .match-details { display: flex; gap: 12px; font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
    .match-detail { display: flex; align-items: center; gap: 3px; }
    .match-detail mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .match-detail.missing { color: var(--warning); }
    .job-badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .badge.easy-apply { background: rgba(34, 197, 94, 0.1); color: var(--success); }
    .badge.source-badge { background: rgba(99, 102, 241, 0.1); color: var(--primary-light); }
    mat-card-actions { display: flex; justify-content: flex-end; padding: 0 16px 8px; }
  `],
})
export class JobSearchJobCardComponent {
  readonly job = input.required<JobResult>();
  readonly selected = input(false);
  readonly toggle = output<void>();
}

@Component({
  selector: 'app-job-search-job-list',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatProgressSpinnerModule,
    JobSearchJobCardComponent,
  ],
  template: `
    <!-- Controls -->
    <div class="results-controls">
      <div class="left">
        <mat-checkbox [checked]="allSelected()" [indeterminate]="someSelected()"
                      (change)="toggleAll.emit($event.checked)">Select All</mat-checkbox>
        <span class="selected-count" *ngIf="selectedIds().size > 0">{{ selectedIds().size }} selected</span>
      </div>
      <div class="right">
        <ng-content select="[actions-left]"></ng-content>
        <button mat-raised-button color="accent" (click)="apply.emit()"
                [disabled]="selectedIds().size === 0 || applying()" class="apply-btn">
          <mat-spinner *ngIf="applying()" diameter="20"></mat-spinner>
          <mat-icon *ngIf="!applying()">send</mat-icon>
          {{ applying() ? 'Applying...' : 'Apply to Selected (' + selectedIds().size + ')' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div *ngIf="loading()" class="loading-section">
      <mat-spinner diameter="40"></mat-spinner>
      <p>{{ loadingMessage() }}</p>
    </div>

    <!-- Empty -->
    <div *ngIf="!loading() && jobs().length === 0 && hasSearched()" class="empty-state">
      <mat-icon>search_off</mat-icon>
      <h2>No jobs found</h2>
      <p>Try different search terms or adjust your filters</p>
      <ng-content select="[empty-actions]"></ng-content>
    </div>

    <!-- Job cards -->
    <div *ngIf="jobs().length > 0" class="job-list fade-in">
      <app-job-search-job-card
        *ngFor="let job of jobs()"
        [job]="job"
        [selected]="selectedIds().has(job.external_id)"
        (toggle)="toggleJob.emit(job.external_id)"
      />
    </div>

    <ng-content></ng-content>
  `,
  styles: [`
    .results-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      flex-wrap: wrap;
      gap: 12px;
    }
    .left { display: flex; align-items: center; gap: 16px; }
    .selected-count {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
      padding: 2px 10px;
      background: rgba(99, 102, 241, 0.08);
      border-radius: 10px;
    }
    .right { display: flex; gap: 8px; }
    .apply-btn { display: flex; align-items: center; gap: 8px; }
    .loading-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 60px 20px;
      color: var(--text-secondary);
    }
    .job-list { display: flex; flex-direction: column; gap: 8px; }
    .empty-state { text-align: center; padding: 60px 20px; }
    .empty-state mat-icon { font-size: 64px; width: 64px; height: 64px; color: var(--text-muted); }
    .empty-state h2 { margin: 16px 0 8px; color: var(--text); }
    .empty-state p { color: var(--text-secondary); margin-bottom: 16px; }
    @media (max-width: 768px) { .results-controls { flex-direction: column; align-items: stretch; } .right { justify-content: stretch; } .right button { flex: 1; } }
  `],
})
export class JobSearchJobListComponent {
  readonly jobs = input.required<JobResult[]>()
  readonly selectedIds = input.required<Set<string>>();
  readonly loading = input(false);
  readonly applying = input(false);
  readonly hasSearched = input(false);
  readonly loadingMessage = input('Searching for jobs...');

  readonly toggleAll = output<boolean>();
  readonly toggleJob = output<string>();
  readonly apply = output<void>();

  allSelected(): boolean {
    return this.jobs().length > 0 && this.jobs().every(j => this.selectedIds().has(j.external_id));
  }

  someSelected(): boolean {
    return this.selectedIds().size > 0 && !this.allSelected();
  }
}
