import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

export interface ApplyResult {
  success: number;
  failed: number;
  failedDetails: { title: string; company: string; reason: string }[];
}

@Component({
  selector: 'app-job-search-results-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatListModule],
  template: `
    <mat-card class="results-summary-card fade-in" *ngIf="visible()">
      <mat-card-header>
        <mat-card-title><mat-icon>assignment_turned_in</mat-icon> Application Results</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="summary-stats">
          <div class="stat-card success">
            <mat-icon>check_circle</mat-icon>
            <span class="stat-value">{{ result().success }}</span>
            <span class="stat-label">Applied Successfully</span>
          </div>
          <div class="stat-card fail">
            <mat-icon>error</mat-icon>
            <span class="stat-value">{{ result().failed }}</span>
            <span class="stat-label">Failed</span>
          </div>
          <div class="stat-card total">
            <mat-icon>work</mat-icon>
            <span class="stat-value">{{ totalSelected() }}</span>
            <span class="stat-label">Total Selected</span>
          </div>
        </div>

        <div class="failed-list" *ngIf="result().failedDetails.length > 0">
          <h3>Failed Applications</h3>
          <mat-list>
            <mat-list-item *ngFor="let fail of result().failedDetails">
              <mat-icon matListItemIcon color="warn">warning</mat-icon>
              <div matListItemTitle>{{ fail.title }} &#64; {{ fail.company }}</div>
              <div matListItemLine>{{ fail.reason }}</div>
            </mat-list-item>
          </mat-list>
        </div>
      </mat-card-content>
      <mat-card-actions align="end">
        <button mat-stroked-button (click)="reset.emit()">
          <mat-icon>refresh</mat-icon> Start New Search
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .results-summary-card {
      margin-top: 24px;
      border: 1px solid var(--success) !important;
      background: rgba(34, 197, 94, 0.04) !important;
    }
    .results-summary-card mat-card-title { display: flex; align-items: center; gap: 8px; color: var(--success); }
    .summary-stats { display: flex; gap: 24px; flex-wrap: wrap; margin: 16px 0; }
    .stat-card { flex: 1; min-width: 150px; padding: 24px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border); }
    .stat-card mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .stat-value { display: block; font-size: 36px; font-weight: 700; margin: 8px 0; }
    .stat-label { font-size: 14px; font-weight: 500; }
    .stat-card.success { background: rgba(34, 197, 94, 0.06); }
    .stat-card.success mat-icon, .stat-card.success .stat-value { color: var(--success); }
    .stat-card.success .stat-label { color: var(--success); }
    .stat-card.fail { background: rgba(239, 68, 68, 0.06); }
    .stat-card.fail mat-icon, .stat-card.fail .stat-value { color: var(--warn); }
    .stat-card.fail .stat-label { color: var(--warn); }
    .stat-card.total { background: rgba(99, 102, 241, 0.06); }
    .stat-card.total mat-icon, .stat-card.total .stat-value { color: var(--primary-light); }
    .stat-card.total .stat-label { color: var(--primary-light); }
    .failed-list { margin-top: 16px; }
    .failed-list h3 { display: flex; align-items: center; gap: 8px; color: var(--warn); margin-bottom: 8px; font-size: 15px; }
    @media (max-width: 768px) { .summary-stats { flex-direction: column; } }
  `],
})
export class JobSearchResultsSummaryComponent {
  readonly visible = input(false);
  readonly result = input.required<ApplyResult>();
  readonly totalSelected = input(0);
  readonly reset = output<void>();
}
