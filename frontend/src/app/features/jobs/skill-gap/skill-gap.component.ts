import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SkillGapResult, MissingSkillAnalysis, JobBreakdownItem } from '../../../core/services/job.service';

@Component({
  selector: 'app-skill-gap',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatTooltipModule,
  ],
  template: `
    <div class="skill-gap-container fade-in">
      <!-- Summary Card -->
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="summary-content">
            <div class="score-section">
              <div class="score-ring" [ngClass]="scoreClass()">
                <svg width="120" height="120" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="2.5"/>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--score-color)" stroke-width="2.5"
                    stroke-dasharray="97.4"
                    [attr.stroke-dashoffset]="97.4 - (97.4 * data().skill_match_percentage / 100)"
                    stroke-linecap="round"
                    style="transition: stroke-dashoffset 0.8s ease"/>
                </svg>
                <span class="score-text">{{ data().skill_match_percentage | number:'1.0-0' }}%</span>
              </div>
              <div class="score-label">
                <strong>Skill Match</strong>
                <span>across {{ data().analyzed_jobs }} jobs</span>
              </div>
            </div>

            <div class="stats-row">
              <div class="stat-item">
                <div class="stat-icon have"><mat-icon>check_circle</mat-icon></div>
                <div class="stat-info">
                  <span class="stat-value">{{ data().skills_i_have?.length || 0 }}</span>
                  <span class="stat-label">Skills You Have</span>
                </div>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <div class="stat-icon missing"><mat-icon>pending</mat-icon></div>
                <div class="stat-info">
                  <span class="stat-value">{{ data().missing_skills?.length || 0 }}</span>
                  <span class="stat-label">Skill Gaps</span>
                </div>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <div class="stat-icon total"><mat-icon>psychology</mat-icon></div>
                <div class="stat-info">
                  <span class="stat-value">{{ data().total_skills_required || 0 }}</span>
                  <span class="stat-label">Skills Required</span>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Your Skills Section -->
      <mat-card class="skills-card" *ngIf="data().my_skills?.length">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="have-icon">check_circle</mat-icon>
            Your Skills
          </mat-card-title>
          <span class="card-badge success">Match</span>
        </mat-card-header>
        <mat-card-content>
          <div class="skills-cloud">
            <span class="skill-chip have"
                  *ngFor="let skill of data().my_skills"
                  [class.required]="isRequired(skill)"
                  [matTooltip]="isRequired(skill) ? 'Required by ' + requiredCount(skill) + ' job(s)' : 'Not currently required by matched jobs'">
              {{ skill }}
              <span class="req-badge" *ngIf="isRequired(skill)">{{ requiredCount(skill) }}</span>
            </span>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Missing Skills Section -->
      <mat-card class="skills-card" *ngIf="data().missing_skills?.length">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="gap-icon">pending_actions</mat-icon>
            Skill Gaps — Prioritized
          </mat-card-title>
          <span class="card-badge warn">Learn</span>
        </mat-card-header>
        <mat-card-content>
          <div class="missing-list">
            <div class="missing-item" *ngFor="let ms of data().missing_skills; let i = index">
              <div class="missing-header">
                <div class="missing-rank">#{{ i + 1 }}</div>
                <div class="missing-skill-info">
                  <strong>{{ ms.skill }}</strong>
                  <span class="missing-freq">
                    Missing in <em>{{ ms.in_percent_of_jobs }}%</em> of matched jobs
                    <span class="freq-bar-wrap">
                      <span class="freq-bar" [style.width.%]="ms.in_percent_of_jobs"></span>
                    </span>
                  </span>
                </div>
              </div>

              <!-- Learning Resources -->
              <div class="resources-section" *ngIf="ms.learning_resources?.length">
                <div class="resources-title">
                  <mat-icon>school</mat-icon> Learning Resources
                </div>
                <div class="resources-list">
                  <a class="resource-item"
                     *ngFor="let r of ms.learning_resources"
                     [href]="r.url"
                     target="_blank"
                     rel="noopener">
                    <span class="resource-name">{{ r.name }}</span>
                    <span class="resource-platform" [ngClass]="platformClass(r.platform)">{{ r.platform }}</span>
                    <mat-icon class="resource-link-icon">open_in_new</mat-icon>
                  </a>
                </div>
              </div>
              <div class="no-resources" *ngIf="!ms.learning_resources?.length">
                <span class="no-resources-text">No specific resources mapped — try searching for "{{ ms.skill }} tutorial"</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Per-Job Breakdown -->
      <mat-card class="jobs-card" *ngIf="data().job_breakdown?.length">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>business</mat-icon>
            Per-Job Breakdown
          </mat-card-title>
          <span class="card-badge info">{{ data().job_breakdown?.length }} jobs</span>
        </mat-card-header>
        <mat-card-content>
          <mat-accordion>
            <mat-expansion-panel *ngFor="let job of data().job_breakdown">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <span class="job-breakdown-title">{{ job.job_title }}</span>
                  <span class="job-breakdown-company">{{ job.company }}</span>
                </mat-panel-title>
                <mat-panel-description>
                  <span class="job-score" [ngClass]="jobScoreClass(job.match_score)">
                    {{ job.match_score | number:'1.0-0' }}%
                  </span>
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="breakdown-details">
                <div class="breakdown-section">
                  <div class="breakdown-label match-label">
                    <mat-icon>check_circle</mat-icon> Matching Skills ({{ job.matching_skills?.length || 0 }})
                  </div>
                  <div class="breakdown-chips" *ngIf="job.matching_skills?.length">
                    <span class="chip have" *ngFor="let s of job.matching_skills">{{ s }}</span>
                  </div>
                  <div class="breakdown-empty" *ngIf="!job.matching_skills?.length">
                    No direct skill matches — your experience may still apply
                  </div>
                </div>

                <div class="breakdown-section">
                  <div class="breakdown-label miss-label">
                    <mat-icon>pending</mat-icon> Missing Skills ({{ job.missing_skills?.length || 0 }})
                  </div>
                  <div class="breakdown-chips" *ngIf="job.missing_skills?.length">
                    <span class="chip miss" *ngFor="let s of job.missing_skills">{{ s }}</span>
                  </div>
                  <div class="breakdown-empty" *ngIf="!job.missing_skills?.length">
                    All required skills matched!
                  </div>
                </div>
              </div>
            </mat-expansion-panel>
          </mat-accordion>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .skill-gap-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .summary-card mat-card-content {
      padding: 24px;
    }
    .summary-content { display: flex; flex-direction: column; align-items: center; gap: 24px; }

    .score-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .score-ring {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      &.high { --score-color: var(--success); }
      &.medium { --score-color: var(--warning); }
      &.low { --score-color: var(--warn); }
    }
    .score-text {
      position: absolute;
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
    }
    .score-label {
      text-align: center;
      strong { display: block; font-size: 16px; color: var(--text); }
      span { font-size: 13px; color: var(--text-secondary); }
    }

    .stats-row {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 16px 24px;
      background: rgba(148,163,184,0.04);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      width: 100%;
      max-width: 600px;
      justify-content: center;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      justify-content: center;
    }
    .stat-divider {
      width: 1px;
      height: 32px;
      background: var(--border);
    }
    .stat-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &.have { background: rgba(34,197,94,0.12); color: var(--success); }
      &.missing { background: rgba(245,158,11,0.12); color: var(--warning); }
      &.total { background: rgba(99,102,241,0.12); color: var(--primary-light); }
    }
    .stat-info {
      .stat-value { font-size: 20px; font-weight: 700; line-height: 1; color: var(--text); }
      .stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    }

    .skills-card {
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px !important;
        }
      }
    }
    .card-badge {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 3px 10px;
      border-radius: 10px;
      &.success { background: rgba(34,197,94,0.1); color: var(--success); }
      &.warn { background: rgba(245,158,11,0.1); color: var(--warning); }
      &.info { background: rgba(99,102,241,0.1); color: var(--primary-light); }
    }
    .have-icon { color: var(--success); }
    .gap-icon { color: var(--warning); }

    .skills-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .skill-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      transition: all var(--transition);
      border: 1px solid transparent;
      &.have {
        background: rgba(148,163,184,0.06);
        color: var(--text-secondary);
        border-color: var(--border);
        &.required {
          background: rgba(34,197,94,0.08);
          color: var(--success);
          border-color: rgba(34,197,94,0.2);
        }
      }
      &:hover { transform: translateY(-1px); }
    }
    .req-badge {
      font-size: 10px;
      font-weight: 700;
      background: rgba(34,197,94,0.15);
      padding: 1px 6px;
      border-radius: 8px;
    }

    .missing-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .missing-item {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      transition: all var(--transition);
      &:hover { border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.02); }
    }
    .missing-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .missing-rank {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(245,158,11,0.1);
      color: var(--warning);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .missing-skill-info {
      flex: 1;
      strong { font-size: 15px; color: var(--text); display: block; margin-bottom: 4px; }
    }
    .missing-freq {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 13px;
      color: var(--text-secondary);
      em { font-style: normal; color: var(--warning); font-weight: 600; }
    }
    .freq-bar-wrap {
      flex: 1;
      min-width: 100px;
      height: 6px;
      background: rgba(148,163,184,0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .freq-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--warning), rgba(245,158,11,0.4));
      border-radius: 3px;
      transition: width 0.6s ease;
    }

    .resources-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .resources-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .resources-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .resource-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      background: rgba(148,163,184,0.04);
      text-decoration: none;
      transition: all var(--transition);
      &:hover {
        background: rgba(99,102,241,0.06);
        .resource-name { color: var(--primary-light); }
      }
    }
    .resource-name {
      flex: 1;
      font-size: 13px;
      color: var(--text);
      transition: color var(--transition);
    }
    .resource-platform {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      &.free { background: rgba(34,197,94,0.1); color: var(--success); }
      &.paid, &.udemy, &.coursera, &.book { background: rgba(99,102,241,0.1); color: var(--primary-light); }
    }
    .resource-link-icon {
      font-size: 14px !important;
      width: 14px !important;
      height: 14px !important;
      color: var(--text-muted);
    }
    .no-resources {
      margin-top: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }

    .jobs-card {
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px !important;
        }
      }
    }

    .job-breakdown-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      margin-right: 8px;
    }
    .job-breakdown-company {
      font-size: 12px;
      color: var(--text-secondary);
    }
    .job-score {
      font-size: 13px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 8px;
      &.high { background: rgba(34,197,94,0.1); color: var(--success); }
      &.medium { background: rgba(245,158,11,0.1); color: var(--warning); }
      &.low { background: rgba(239,68,68,0.1); color: var(--warn); }
    }

    .breakdown-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 4px 0;
    }
    .breakdown-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .breakdown-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.match-label { color: var(--success); }
      &.miss-label { color: var(--warning); }
    }
    .breakdown-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid transparent;
      &.have {
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
    .breakdown-empty {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
      padding: 4px 0;
    }

    mat-expansion-panel {
      background: transparent !important;
      border: 1px solid var(--border) !important;
      margin-bottom: 6px;
      border-radius: var(--radius-md) !important;
      box-shadow: none !important;
    }
  `],
})
export class SkillGapComponent {
  readonly data = input.required<SkillGapResult>();

  private get counts(): Map<string, number> {
    const counts = new Map<string, number>();
    const jobs = this.data()?.job_breakdown;
    if (jobs) {
      for (const job of jobs) {
        for (const skill of [...job.matching_skills, ...job.missing_skills]) {
          counts.set(skill, (counts.get(skill) || 0) + 1);
        }
      }
    }
    return counts;
  }

  isRequired(skill: string): boolean {
    return (this.counts.get(skill) || 0) > 0;
  }

  requiredCount(skill: string): number {
    return this.counts.get(skill) || 0;
  }

  scoreClass(): string {
    const pct = this.data()?.skill_match_percentage || 0;
    if (pct >= 80) return 'high';
    if (pct >= 60) return 'medium';
    return 'low';
  }

  jobScoreClass(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  platformClass(platform: string): string {
    if (!platform) return 'free';
    return platform.toLowerCase().replace(/[^a-z]/g, '');
  }
}
