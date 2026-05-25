import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-job-search-apply-progress',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="apply-overlay" *ngIf="visible()">
      <mat-card class="apply-progress-card">
        <mat-card-header>
          <mat-card-title><mat-icon>rocket_launch</mat-icon> Applying to Jobs</mat-card-title>
          <mat-card-subtitle>
            Applied {{ success() + failed() }} of {{ total() }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="apply-progress">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" [style.width.%]="total() > 0 ? ((success() + failed()) / total()) * 100 : 0"></div>
            </div>
            <div class="progress-stats">
              <div class="stat success">
                <mat-icon>check_circle</mat-icon>
                <span>{{ success() }} Success</span>
              </div>
              <div class="stat fail">
                <mat-icon>error</mat-icon>
                <span>{{ failed() }} Failed</span>
              </div>
            </div>
            <div class="current-job" *ngIf="currentJob()">
              <mat-spinner diameter="16"></mat-spinner>
              <span>Applying to {{ currentJob() }}...</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .apply-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .apply-progress-card { min-width: 400px; max-width: 500px; }
    .apply-progress-card mat-card-title { display: flex; align-items: center; gap: 8px; }
    .progress-bar-track { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 16px; }
    .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--success)); border-radius: 3px; transition: width 0.3s ease; }
    .progress-stats { display: flex; gap: 24px; margin-bottom: 12px; }
    .stat { display: flex; align-items: center; gap: 6px; font-size: 14px; }
    .stat.success { color: var(--success); }
    .stat.fail { color: var(--warn); }
    .current-job { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 14px; margin-top: 8px; }
    @media (max-width: 768px) { .apply-progress-card { min-width: unset; margin: 16px; } }
  `],
})
export class JobSearchApplyProgressComponent {
  readonly visible = input(false);
  readonly total = input(0);
  readonly success = input(0);
  readonly failed = input(0);
  readonly currentJob = input<string>('');
}
