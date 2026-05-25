import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { TrackingService, TrackingStats, TimelineEntry } from '../../core/services/tracking.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTabsModule, MatSelectModule, MatTooltipModule, RouterLink,
  ],
  template: `
    <div class="container">
      <h1 class="page-title">Analytics</h1>

      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!isLoading && stats" class="analytics-grid">
        <!-- Conversion Funnel -->
        <mat-card class="card funnel-card">
          <mat-card-header>
            <mat-card-title><mat-icon>funnel</mat-icon> Application Funnel</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="funnel">
              <div class="funnel-step" style="width:100%">
                <div class="funnel-bar" style="width:100%">
                  <span class="funnel-label">Total</span>
                  <span class="funnel-value">{{ totalApplications }}</span>
                </div>
              </div>
              <div class="funnel-step" [style.width.%]="appliedPct">
                <div class="funnel-bar applied">
                  <span class="funnel-label">Applied</span>
                  <span class="funnel-value">{{ appliedCount }}</span>
                </div>
              </div>
              <div class="funnel-step" [style.width.%]="interviewPct">
                <div class="funnel-bar interview">
                  <span class="funnel-label">Interview</span>
                  <span class="funnel-value">{{ interviewCount }}</span>
                </div>
              </div>
              <div class="funnel-step" [style.width.%]="offerPct">
                <div class="funnel-bar offer">
                  <span class="funnel-label">Offer</span>
                  <span class="funnel-value">{{ offerCount }}</span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Conversion Rates -->
        <mat-card class="card rates-card">
          <mat-card-header>
            <mat-card-title><mat-icon>trending_up</mat-icon> Conversion Rates</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="rates-grid">
              <div class="rate-item">
                <div class="rate-ring">
                  <svg width="80" height="80" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="3"/>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--primary-light)" stroke-width="3"
                      stroke-dasharray="97.4" [attr.stroke-dashoffset]="97.4 - (97.4 * stats.conversion_rates.application_to_interview / 100)"
                      stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease"/>
                  </svg>
                  <span class="rate-value">{{ stats.conversion_rates.application_to_interview | number:'1.0-0' }}%</span>
                </div>
                <span class="rate-label">App → Interview</span>
              </div>
              <div class="rate-item">
                <div class="rate-ring">
                  <svg width="80" height="80" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="3"/>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" stroke-width="3"
                      stroke-dasharray="97.4" [attr.stroke-dashoffset]="97.4 - (97.4 * stats.conversion_rates.interview_to_offer / 100)"
                      stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease"/>
                  </svg>
                  <span class="rate-value">{{ stats.conversion_rates.interview_to_offer | number:'1.0-0' }}%</span>
                </div>
                <span class="rate-label">Interview → Offer</span>
              </div>
              <div class="rate-item">
                <div class="rate-ring">
                  <svg width="80" height="80" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="3"/>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--success)" stroke-width="3"
                      stroke-dasharray="97.4" [attr.stroke-dashoffset]="97.4 - (97.4 * stats.conversion_rates.application_to_offer / 100)"
                      stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease"/>
                  </svg>
                  <span class="rate-value">{{ stats.conversion_rates.application_to_offer | number:'1.0-0' }}%</span>
                </div>
                <span class="rate-label">App → Offer</span>
              </div>
              <div class="rate-item">
                <div class="rate-ring">
                  <svg width="80" height="80" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="3"/>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--warning)" stroke-width="3"
                      stroke-dasharray="97.4" [attr.stroke-dashoffset]="97.4 - (97.4 * rejectionRate / 100)"
                      stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease"/>
                  </svg>
                  <span class="rate-value">{{ rejectionRate | number:'1.0-0' }}%</span>
                </div>
                <span class="rate-label">Rejection Rate</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Status Breakdown -->
        <mat-card class="card status-card">
          <mat-card-header>
            <mat-card-title><mat-icon>pie_chart</mat-icon> Status Breakdown</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="status-grid">
              <div class="status-item pending" *ngIf="byStatus('pending') > 0">
                <div class="status-bar" [style.width.%]="byStatusPct('pending')"></div>
                <span class="status-name">Pending</span>
                <span class="status-value">{{ byStatus('pending') }}</span>
              </div>
              <div class="status-item applied" *ngIf="byStatus('applied') > 0">
                <div class="status-bar" [style.width.%]="byStatusPct('applied')"></div>
                <span class="status-name">Applied</span>
                <span class="status-value">{{ byStatus('applied') }}</span>
              </div>
              <div class="status-item screening" *ngIf="byStatus('screening') > 0">
                <div class="status-bar" [style.width.%]="byStatusPct('screening')"></div>
                <span class="status-name">Screening</span>
                <span class="status-value">{{ byStatus('screening') }}</span>
              </div>
              <div class="status-item interview" *ngIf="byStatus('interview') > 0">
                <div class="status-bar" [style.width.%]="byStatusPct('interview')"></div>
                <span class="status-name">Interview</span>
                <span class="status-value">{{ byStatus('interview') }}</span>
              </div>
              <div class="status-item offer" *ngIf="byStatus('offer') > 0">
                <div class="status-bar" [style.width.%]="byStatusPct('offer')"></div>
                <span class="status-name">Offer</span>
                <span class="status-value">{{ byStatus('offer') }}</span>
              </div>
              <div class="status-item rejected" *ngIf="byStatus('rejected') > 0">
                <div class="status-bar" [style.width.%]="byStatusPct('rejected')"></div>
                <span class="status-name">Rejected</span>
                <span class="status-value">{{ byStatus('rejected') }}</span>
              </div>
              <div class="status-item ghosted" *ngIf="byStatus('ghosted') > 0">
                <div class="status-bar" [style.width.%]="byStatusPct('ghosted')"></div>
                <span class="status-name">Ghosted</span>
                <span class="status-value">{{ byStatus('ghosted') }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Timeline -->
        <mat-card class="card timeline-card">
          <mat-card-header>
            <mat-card-title><mat-icon>timeline</mat-icon> Weekly Activity</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="weeklyData.length === 0" class="empty-chart">
              <mat-icon>bar_chart</mat-icon>
              <p>No application data yet</p>
              <button mat-stroked-button routerLink="/jobs">Find Jobs</button>
            </div>

            <div *ngIf="weeklyData.length > 0" class="bar-chart">
              <div class="chart-y-axis">
                <span>{{ maxWeekly }}</span>
                <span>{{ maxWeekly / 2 | number:'1.0-0' }}</span>
                <span>0</span>
              </div>
              <div class="chart-bars">
                <div *ngFor="let w of weeklyData" class="bar-column">
                  <div class="bar-wrapper">
                    <div class="bar" [style.height.%]="(w.count / maxWeekly) * 100" 
                         [matTooltip]="w.label + ': ' + w.count + ' applications'"
                         matTooltipPosition="above">
                    </div>
                  </div>
                  <span class="bar-label">{{ w.shortLabel }}</span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Summary Stats -->
        <mat-card class="card summary-card">
          <mat-card-header>
            <mat-card-title><mat-icon>summarize</mat-icon> Summary</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="summary-grid">
              <div class="summary-item">
                <mat-icon>work</mat-icon>
                <span class="summary-value">{{ stats.total_applications }}</span>
                <span class="summary-label">Total Applications</span>
              </div>
              <div class="summary-item">
                <mat-icon>date_range</mat-icon>
                <span class="summary-value">{{ stats.recent_applications }}</span>
                <span class="summary-label">Last 30 Days</span>
              </div>
              <div class="summary-item">
                <mat-icon>event</mat-icon>
                <span class="summary-value">{{ stats.upcoming_interviews }}</span>
                <span class="summary-label">Upcoming Interviews</span>
              </div>
              <div class="summary-item" *ngIf="avgMatchScore > 0">
                <mat-icon>psychology</mat-icon>
                <span class="summary-value">{{ avgMatchScore | number:'1.0-0' }}%</span>
                <span class="summary-label">Avg Match Score</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Company Breakdown -->
        <mat-card class="card companies-card" *ngIf="companyData.length > 0">
          <mat-card-header>
            <mat-card-title><mat-icon>business</mat-icon> Top Companies</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="company-list">
              <div *ngFor="let c of companyData.slice(0, 8)" class="company-row">
                <span class="company-name">{{ c.company }}</span>
                <div class="company-bar-track">
                  <div class="company-bar" [style.width.%]="(c.count / maxCompany) * 100"></div>
                </div>
                <span class="company-count">{{ c.count }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Match Score Distribution -->
        <mat-card class="card match-dist-card" *ngIf="matchDistData.length > 0">
          <mat-card-header>
            <mat-card-title><mat-icon>bar_chart</mat-icon> Match Score Distribution</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="bar-chart compact">
              <div class="chart-bars">
                <div *ngFor="let m of matchDistData" class="bar-column">
                  <div class="bar-wrapper">
                    <div class="bar" [style.height.%]="(m.count / maxMatchDist) * 100"
                         [class.high]="m.label.includes('80') || m.label.includes('90')"
                         [class.medium]="m.label.includes('60') || m.label.includes('70')"
                         [class.low]="m.label.includes('0') || m.label.includes('10') || m.label.includes('20')">
                    </div>
                  </div>
                  <span class="bar-label">{{ m.label }}</span>
                  <span class="bar-value">{{ m.count }}</span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .analytics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .card {
      mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 16px !important; }
    }

    .funnel-card, .rates-card { grid-column: 1 / -1; }

    .funnel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 0;
    }
    .funnel-step {
      transition: width 0.5s ease;
    }
    .funnel-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-radius: var(--radius-md);
      background: var(--bg-card-hover);
      border: 1px solid var(--border);
      font-weight: 600;
      &.applied { background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2); }
      &.interview { background: rgba(6, 182, 212, 0.1); border-color: rgba(6, 182, 212, 0.2); }
      &.offer { background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.2); }
    }
    .funnel-label { font-size: 14px; color: var(--text-secondary); }
    .funnel-value { font-size: 18px; color: var(--text); }

    .rates-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 16px 0;
    }
    .rate-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .rate-ring {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      svg { transform: rotate(-90deg); }
    }
    .rate-value {
      position: absolute;
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
    }
    .rate-label { font-size: 12px; color: var(--text-muted); font-weight: 500; text-align: center; }

    .status-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .status-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-bar {
      height: 8px;
      border-radius: 4px;
      transition: width 0.5s ease;
      min-width: 4px;
    }
    .pending .status-bar { background: var(--warning); }
    .applied .status-bar { background: var(--primary-light); }
    .screening .status-bar { background: #c084fc; }
    .interview .status-bar { background: var(--accent); }
    .offer .status-bar { background: var(--success); }
    .rejected .status-bar { background: var(--warn); }
    .ghosted .status-bar { background: var(--text-muted); }
    .status-name { flex: 1; font-size: 14px; color: var(--text-secondary); }
    .status-value { font-size: 14px; font-weight: 600; color: var(--text); min-width: 24px; text-align: right; }

    .timeline-card, .summary-card { grid-column: 1 / -1; }
    .match-dist-card { grid-column: 1 / -1; }

    .bar-chart {
      display: flex;
      gap: 8px;
      padding: 16px 0;
      height: 180px;
    }
    .bar-chart.compact { height: 140px; }
    .chart-y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-right: 8px;
      font-size: 11px;
      color: var(--text-muted);
      min-width: 30px;
      text-align: right;
    }
    .chart-bars {
      display: flex;
      flex: 1;
      align-items: flex-end;
      gap: 4px;
    }
    .bar-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      height: 100%;
    }
    .bar-wrapper {
      flex: 1;
      width: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .bar {
      width: 100%;
      max-width: 40px;
      border-radius: 4px 4px 0 0;
      background: linear-gradient(180deg, var(--primary-light), var(--primary));
      transition: height 0.5s ease;
      min-height: 4px;
      cursor: pointer;
      &.high { background: linear-gradient(180deg, var(--success), #16a34a); }
      &.medium { background: linear-gradient(180deg, var(--warning), #d97706); }
      &.low { background: linear-gradient(180deg, var(--warn), #dc2626); }
    }
    .bar:hover { opacity: 0.8; }
    .bar-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
    .bar-value { font-size: 10px; color: var(--text-muted); font-weight: 600; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 8px 0;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 20px;
      border-radius: var(--radius-md);
      background: rgba(148, 163, 184, 0.04);
      border: 1px solid var(--border);
      text-align: center;
      mat-icon { color: var(--primary-light); font-size: 28px; width: 28px; height: 28px; }
    }
    .summary-value { font-size: 28px; font-weight: 700; color: var(--text); }
    .summary-label { font-size: 12px; color: var(--text-muted); font-weight: 500; }

    .companies-card { grid-column: 1 / -1; }
    .company-list { display: flex; flex-direction: column; gap: 10px; }
    .company-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-name { width: 120px; font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .company-bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .company-bar { height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-light)); border-radius: 4px; transition: width 0.5s ease; }
    .company-count { font-size: 14px; font-weight: 600; color: var(--text-secondary); min-width: 24px; text-align: right; }

    .empty-chart {
      text-align: center;
      padding: 24px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--text-muted); }
      p { margin: 12px 0; color: var(--text-secondary); }
    }

    @media (max-width: 768px) {
      .analytics-grid { grid-template-columns: 1fr; }
      .rates-grid { grid-template-columns: repeat(2, 1fr); }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class AnalyticsComponent implements OnInit {
  private trackingService = inject(TrackingService);

  isLoading = true;
  stats: TrackingStats | null = null;
  timeline: TimelineEntry[] = [];

  weeklyData: { label: string; shortLabel: string; count: number }[] = [];
  companyData: { company: string; count: number }[] = [];
  matchDistData: { label: string; count: number }[] = [];

  maxWeekly = 0;
  maxCompany = 0;
  maxMatchDist = 0;
  avgMatchScore = 0;

  get totalApplications(): number {
    return this.stats?.total_applications || 0;
  }
  get appliedCount(): number {
    return this.byStatus('applied') + this.byStatus('screening') + this.byStatus('interview') + this.byStatus('offer');
  }
  get interviewCount(): number {
    return this.byStatus('interview');
  }
  get offerCount(): number {
    return this.byStatus('offer');
  }

  get appliedPct(): number {
    return this.totalApplications > 0 ? (this.appliedCount / this.totalApplications) * 100 : 0;
  }
  get interviewPct(): number {
    return this.totalApplications > 0 ? (this.interviewCount / this.totalApplications) * 100 : 0;
  }
  get offerPct(): number {
    return this.totalApplications > 0 ? (this.offerCount / this.totalApplications) * 100 : 0;
  }
  get rejectionRate(): number {
    const total = this.byStatus('rejected') + this.byStatus('applied') + this.byStatus('screening') + this.byStatus('interview') + this.byStatus('offer');
    return total > 0 ? (this.byStatus('rejected') / total) * 100 : 0;
  }

  byStatus(status: string): number {
    return this.stats?.by_status[status] || 0;
  }

  byStatusPct(status: string): number {
    const total = this.totalApplications;
    return total > 0 ? (this.byStatus(status) / total) * 100 : 0;
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.trackingService.getStats(90).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.buildWeeklyData();
        this.buildCompanyData();
        this.buildMatchDistData();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });

    this.trackingService.getTimeline(90).subscribe({
      next: (timeline) => {
        this.timeline = timeline;
        this.buildWeeklyData();
        this.buildCompanyData();
        this.buildMatchDistData();
        const scores = timeline.filter(t => t.match_score != null).map(t => t.match_score!);
        this.avgMatchScore = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;
      },
    });
  }

  private buildWeeklyData(): void {
    if (this.timeline.length === 0) return;

    const weeks: Record<string, number> = {};
    const weekOrder: string[] = [];

    for (const entry of this.timeline) {
      const d = new Date(entry.date);
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      if (!weeks[key]) {
        weeks[key] = 0;
        weekOrder.push(key);
      }
      weeks[key]++;
    }

    this.weeklyData = weekOrder.slice(-12).map(key => {
      const [y, w] = key.split('-W');
      return {
        label: key,
        shortLabel: `W${w}`,
        count: weeks[key],
      };
    });

    this.maxWeekly = Math.max(...this.weeklyData.map(w => w.count), 1);
  }

  private buildCompanyData(): void {
    const companies: Record<string, number> = {};
    for (const entry of this.timeline) {
      const c = entry.company;
      if (c && c !== 'Unknown') {
        companies[c] = (companies[c] || 0) + 1;
      }
    }
    this.companyData = Object.entries(companies)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count);
    this.maxCompany = Math.max(...this.companyData.map(c => c.count), 1);
  }

  private buildMatchDistData(): void {
    const buckets: Record<string, number> = {
      '0-20%': 0, '21-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0,
    };
    for (const entry of this.timeline) {
      if (entry.match_score != null) {
        const s = entry.match_score;
        if (s <= 20) buckets['0-20%']++;
        else if (s <= 40) buckets['21-40%']++;
        else if (s <= 60) buckets['41-60%']++;
        else if (s <= 80) buckets['61-80%']++;
        else buckets['81-100%']++;
      }
    }
    this.matchDistData = Object.entries(buckets).map(([label, count]) => ({ label, count }));
    this.maxMatchDist = Math.max(...this.matchDistData.map(m => m.count), 1);
  }
}
