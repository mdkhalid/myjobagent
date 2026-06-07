import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ResumeService, Resume, TailorResponse, Suggestion, AtsScore, AtsCategoryScores } from '../../../core/services/resume.service';
import { TailoredPreviewDialog } from './tailored-preview.dialog';

interface SuggestionWithState extends Suggestion {
  accepted: boolean;
}

@Component({
  selector: 'app-resume-tailor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
  ],
  template: `
    <div class="tailor-page">
      <!-- Header -->
      <div class="header">
        <button mat-stroked-button routerLink="/resumes">
          <mat-icon>arrow_back</mat-icon>
          Back to Resumes
        </button>
        <h1>Resume Tailor</h1>
        <div></div>
      </div>

      <!-- JD Input -->
      <mat-card class="jd-card glass-card" *ngIf="!tailorResult()">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>work</mat-icon>
            Enter Job Description
          </mat-card-title>
          <mat-card-subtitle>
            Paste a job description to tailor your resume — "{{ resume()?.filename }}"
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="jd-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Job Title</mat-label>
              <input matInput [(ngModel)]="jobTitle" placeholder="e.g. Senior Frontend Engineer">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Job Description</mat-label>
              <textarea matInput [(ngModel)]="jobDescription" rows="12"
                placeholder="Paste the full job description here..."></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Required Skills (optional, comma-separated)</mat-label>
              <input matInput [(ngModel)]="jobSkillsInput" placeholder="e.g. React, TypeScript, AWS">
            </mat-form-field>

            <div class="jd-actions">
              <button mat-raised-button color="primary"
                (click)="analyze()"
                [disabled]="!jobTitle || !jobDescription || isLoading()"
                class="analyze-btn">
                <mat-icon *ngIf="!isLoading()">auto_awesome</mat-icon>
                <mat-spinner *ngIf="isLoading()" diameter="20"></mat-spinner>
                {{ isLoading() ? 'Analyzing...' : 'Analyze & Tailor Resume' }}
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Results -->
      <ng-container *ngIf="tailorResult()">
        <!-- Score Dashboard -->
        <div class="score-dashboard fade-in">
          <mat-card class="score-card glass-card" [ngClass]="scoreClass()">
            <mat-card-content>
              <div class="score-inner">
                <div class="score-ring-wrapper">
                  <div class="score-ring" [ngClass]="scoreClass()">
                    <svg width="140" height="140" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="2.5"/>
                      <circle cx="18" cy="18" r="15.5" fill="none"
                        [attr.stroke]="scoreColor()"
                        stroke-width="2.5"
                        [attr.stroke-dasharray]="97.4"
                        [attr.stroke-dashoffset]="97.4 - (97.4 * atsScore().overall / 100)"
                        stroke-linecap="round"
                        style="transition: stroke-dashoffset 1s ease"/>
                    </svg>
                    <span class="score-text">{{ atsScore().overall | number:'1.0-0' }}</span>
                    <span class="score-label">ATS Score</span>
                  </div>
                </div>
                <div class="score-details">
                  <div class="category-scores">
                    <div class="category" *ngFor="let cat of categoryKeys">
                      <div class="cat-header">
                        <span class="cat-name">{{ cat | titlecase }}</span>
                        <span class="cat-value" [ngClass]="catClass(atsScore().categories[cat])">
                          {{ atsScore().categories[cat] | number:'1.0-0' }}%
                        </span>
                      </div>
                      <div class="cat-bar">
                        <div class="cat-bar-fill" [ngClass]="catClass(atsScore().categories[cat])"
                          [style.width.%]="atsScore().categories[cat]"></div>
                      </div>
                    </div>
                  </div>

                  <div class="score-meta">
                    <div class="meta-section strengths">
                      <h4><mat-icon>check_circle</mat-icon> Strengths</h4>
                      <ul>
                        <li *ngFor="let s of atsScore().strengths">{{ s }}</li>
                      </ul>
                    </div>
                    <div class="meta-section improvements">
                      <h4><mat-icon>lightbulb</mat-icon> Improvements</h4>
                      <ul>
                        <li *ngFor="let i of atsScore().improvements">{{ i }}</li>
                      </ul>
                    </div>
                    <div class="meta-section missing" *ngIf="atsScore().missing_keywords?.length">
                      <h4><mat-icon>priority_high</mat-icon> Missing Keywords</h4>
                      <mat-chip-set>
                        <mat-chip *ngFor="let kw of atsScore().missing_keywords" class="miss-chip">
                          {{ kw }}
                        </mat-chip>
                      </mat-chip-set>
                    </div>
                  </div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Tailoring Suggestions -->
        <div class="suggestions-section fade-in">
          <mat-card class="glass-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>edit_note</mat-icon>
                Tailoring Suggestions
              </mat-card-title>
              <mat-card-subtitle>
                Review and accept suggestions to improve your ATS score
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="suggestion-filters">
                <button mat-stroked-button
                  *ngFor="let tab of suggestionTabs"
                  (click)="activeTab.set(tab.key)"
                  [class.active]="activeTab() === tab.key">
                  <mat-icon>{{ tab.icon }}</mat-icon>
                  {{ tab.label }}
                  <span class="tab-count" *ngIf="tab.key === 'all'">{{ suggestionsList().length }}</span>
                  <span class="tab-count" *ngIf="tab.key !== 'all'">{{ filteredBySection(tab.key).length }}</span>
                </button>
              </div>

              <div class="suggestion-summary">
                <span>{{ acceptedCount() }} / {{ suggestionsList().length }} suggestions accepted</span>
                <mat-progress-bar mode="determinate"
                  [value]="suggestionsList().length ? (acceptedCount() / suggestionsList().length) * 100 : 0"
                  class="accept-progress"></mat-progress-bar>
              </div>

              <div class="suggestions-list">
                <div class="suggestion-item"
                  *ngFor="let sugg of filteredSuggestions(); let i = index"
                  [class.accepted]="sugg.accepted"
                  [class.rejected]="!sugg.accepted && hasReviewed()">
                  <div class="suggestion-header">
                    <div class="suggestion-type-badge" [ngClass]="sugg.type">
                      {{ sugg.type | titlecase }}
                    </div>
                    <div class="suggestion-section-badge">
                      {{ sugg.section | titlecase }}
                    </div>
                    <span class="suggestion-reason">{{ sugg.reason }}</span>
                    <span class="spacer"></span>
                    <button mat-icon-button
                      [color]="sugg.accepted ? 'primary' : ''"
                      (click)="toggleSuggestion(sugg)"
                      [matTooltip]="sugg.accepted ? 'Remove' : 'Accept'">
                      <mat-icon>{{ sugg.accepted ? 'check_circle' : 'check_circle_outline' }}</mat-icon>
                    </button>
                  </div>
                  <div class="suggestion-content">
                    <div class="original-text" *ngIf="sugg.original_text">
                      <div class="text-label">Original:</div>
                      <div class="text-content removed">{{ sugg.original_text }}</div>
                    </div>
                    <div class="suggested-text">
                      <div class="text-label">{{ sugg.original_text ? 'Suggested:' : 'Add:' }}</div>
                      <div class="text-content added" [class.new-text]="!sugg.original_text">
                        {{ sugg.suggested_text }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="suggestions-actions" *ngIf="suggestionsList().length">
                <button mat-stroked-button (click)="acceptAll()">
                  <mat-icon>select_all</mat-icon>
                  Accept All
                </button>
                <button mat-stroked-button (click)="rejectAll()">
                  <mat-icon>deselect</mat-icon>
                  Clear All
                </button>
                <span class="spacer"></span>
                <button mat-raised-button color="primary"
                  (click)="saveTailored()"
                  [disabled]="acceptedCount() === 0 || isSaving()">
                  <mat-icon *ngIf="!isSaving()">save</mat-icon>
                  <mat-spinner *ngIf="isSaving()" diameter="20"></mat-spinner>
                  Save Tailored Resume
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .tailor-page { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; h1 { margin: 0; font-size: 28px; font-weight: 500; } }
    .jd-card mat-card-header { mat-icon { color: var(--primary-light); } }
    .jd-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .jd-actions { display: flex; justify-content: flex-end; }
    .analyze-btn { display: flex; align-items: center; gap: 8px; padding: 8px 24px; mat-spinner { --mdc-circular-progress-active-indicator-color: white; } }
    .score-dashboard { margin-bottom: 20px; }
    .score-inner { display: flex; gap: 32px; align-items: flex-start; }
    .score-ring-wrapper { flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .score-ring { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; &.high { --score-color: var(--success); } &.medium { --score-color: var(--warning); } &.low { --score-color: var(--warn); } }
    .score-text { position: absolute; font-size: 32px; font-weight: 700; color: var(--text); top: 35%; }
    .score-label { position: absolute; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; top: 58%; }
    .score-details { flex: 1; display: flex; flex-direction: column; gap: 16px; }
    .category-scores { display: flex; flex-direction: column; gap: 10px; }
    .category { display: flex; flex-direction: column; gap: 4px; }
    .cat-header { display: flex; justify-content: space-between; font-size: 13px; }
    .cat-name { color: var(--text-secondary); font-weight: 500; }
    .cat-value { font-weight: 700; &.high { color: var(--success); } &.medium { color: var(--warning); } &.low { color: var(--warn); } }
    .cat-bar { height: 6px; background: rgba(148,163,184,0.1); border-radius: 3px; overflow: hidden; }
    .cat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; &.high { background: var(--success); } &.medium { background: var(--warning); } &.low { background: var(--warn); } }
    .score-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .meta-section { padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border); h4 { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 8px; mat-icon { font-size: 16px; width: 16px; height: 16px; } } ul { margin: 0; padding-left: 16px; font-size: 12px; color: var(--text-secondary); li { margin-bottom: 4px; } } &.strengths h4 { color: var(--success); } &.improvements h4 { color: var(--warning); } &.missing { grid-column: 1 / -1; h4 { color: var(--warn); } } }
    .miss-chip { background: rgba(239,68,68,0.08) !important; color: var(--warn) !important; border: 1px solid rgba(239,68,68,0.15); }
    .suggestion-filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; button { display: flex; align-items: center; gap: 6px; font-size: 13px; &.active { border-color: var(--primary) !important; color: var(--primary-light) !important; background: rgba(99,102,241,0.08); } mat-icon { font-size: 18px; width: 18px; height: 18px; } } }
    .tab-count { background: rgba(148,163,184,0.12); padding: 1px 7px; border-radius: 8px; font-size: 11px; font-weight: 700; }
    .suggestion-summary { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); }
    .accept-progress { flex: 1; max-width: 200px; }
    .suggestions-list { display: flex; flex-direction: column; gap: 12px; }
    .suggestion-item { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; transition: all var(--transition); &.accepted { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.03); } &:hover { border-color: var(--border-light); } }
    .suggestion-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .suggestion-type-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 6px; &.rewrite { background: rgba(99,102,241,0.1); color: var(--primary-light); } &.add { background: rgba(34,197,94,0.1); color: var(--success); } &.remove { background: rgba(239,68,68,0.1); color: var(--warn); } }
    .suggestion-section-badge { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 6px; background: rgba(148,163,184,0.08); color: var(--text-secondary); }
    .suggestion-reason { flex: 1; font-size: 12px; color: var(--text-muted); font-style: italic; min-width: 100px; }
    .suggestion-content { display: flex; flex-direction: column; gap: 8px; }
    .original-text, .suggested-text { padding: 10px 12px; border-radius: var(--radius-sm); font-size: 13px; line-height: 1.5; }
    .text-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; color: var(--text-muted); }
    .original-text { background: rgba(239,68,68,0.04); }
    .text-content.removed { color: var(--warn); text-decoration: line-through; opacity: 0.7; }
    .suggested-text { background: rgba(34,197,94,0.04); }
    .text-content.added { color: var(--success); }
    .suggestions-actions { display: flex; align-items: center; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); button { display: flex; align-items: center; gap: 6px; mat-spinner { --mdc-circular-progress-active-indicator-color: white; } } }
    .spacer { flex: 1; }
    @media (max-width: 768px) { .score-inner { flex-direction: column; align-items: center; } .score-meta { grid-template-columns: 1fr; } }
  `]
})
export class ResumeTailorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private resumeService = inject(ResumeService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  resume = signal<Resume | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  tailorResult = signal<TailorResponse | null>(null);
  activeTab = signal<string>('all');
  suggestionsList = signal<SuggestionWithState[]>([]);

  jobTitle = '';
  jobDescription = '';
  jobSkillsInput = '';

  readonly suggestionTabs = [
    { key: 'all', label: 'All', icon: 'list' },
    { key: 'summary', label: 'Summary', icon: 'summarize' },
    { key: 'experience', label: 'Experience', icon: 'work_history' },
    { key: 'skills', label: 'Skills', icon: 'psychology' },
    { key: 'education', label: 'Education', icon: 'school' },
  ];

  readonly categoryKeys: (keyof AtsCategoryScores)[] = ['keywords', 'skills', 'experience', 'education', 'formatting'];

  ngOnInit(): void {
    const resumeId = this.route.snapshot.paramMap.get('id');
    if (!resumeId) {
      this.snackBar.open('No resume selected', 'Close', { duration: 3000 });
      this.router.navigate(['/resumes']);
      return;
    }

    this.resumeService.getResumes().subscribe({
      next: (resumes) => {
        const found = resumes.find(r => r.id === resumeId);
        if (found) this.resume.set(found);
        else {
          this.snackBar.open('Resume not found', 'Close', { duration: 3000 });
          this.router.navigate(['/resumes']);
        }
      },
      error: () => {
        this.snackBar.open('Failed to load resume', 'Close', { duration: 3000 });
        this.router.navigate(['/resumes']);
      }
    });
  }

  atsScore = computed<AtsScore>(() => {
    const result = this.tailorResult();
    return result?.ats_score || {
      overall: 0,
      categories: { keywords: 0, formatting: 0, experience: 0, education: 0, skills: 0 },
      strengths: [], improvements: [], missing_keywords: []
    };
  });

  scoreClass = computed(() => {
    const s = this.atsScore().overall;
    return s >= 80 ? 'high' : s >= 60 ? 'medium' : 'low';
  });

  scoreColor = computed(() => {
    const c = this.scoreClass();
    return c === 'high' ? 'var(--success)' : c === 'medium' ? 'var(--warning)' : 'var(--warn)';
  });

  filteredSuggestions = computed(() => {
    const tab = this.activeTab();
    const list = this.suggestionsList();
    return tab === 'all' ? list : list.filter(s => s.section === tab);
  });

  acceptedCount = computed(() => this.suggestionsList().filter(s => s.accepted).length);
  hasReviewed = computed(() => this.suggestionsList().some(s => s.accepted));

  filteredBySection(section: string): SuggestionWithState[] {
    return this.suggestionsList().filter(s => s.section === section);
  }

  catClass(score: number): string {
    return score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
  }

  toggleSuggestion(sugg: SuggestionWithState): void {
    sugg.accepted = !sugg.accepted;
    this.suggestionsList.set([...this.suggestionsList()]);
  }

  acceptAll(): void {
    this.suggestionsList().forEach(s => s.accepted = true);
    this.suggestionsList.set([...this.suggestionsList()]);
    this.snackBar.open(`✅ ${this.suggestionsList().length} suggestions accepted`, 'Close', { duration: 2000 });
  }

  rejectAll(): void {
    this.suggestionsList().forEach(s => s.accepted = false);
    this.suggestionsList.set([...this.suggestionsList()]);
    this.snackBar.open('All suggestions cleared', 'Close', { duration: 2000 });
  }

  /** Build the full tailored resume text from original parsed content + accepted suggestions */
  private buildTailoredText(): string {
    const resume = this.resume();
    const pc = resume?.parsed_content || {};
    const accepted = this.suggestionsList().filter(s => s.accepted);

    // Collect accepted text by section for quick lookup
    const addTexts: Record<string, string[]> = {};
    const rewriteTexts: Record<string, string[]> = {};
    const removeKeys: Set<string> = new Set();

    for (const s of accepted) {
      if (s.type === 'add') {
        (addTexts[s.section] = addTexts[s.section] || []).push(s.suggested_text);
      } else if (s.type === 'rewrite') {
        (rewriteTexts[s.section] = rewriteTexts[s.section] || []).push(s.suggested_text);
      } else if (s.type === 'remove') {
        removeKeys.add(s.original_text.toLowerCase().trim());
      }
    }

    const lines: string[] = [];
    const name = (pc as any).full_name || resume?.filename?.replace(/\.[^.]+$/, '') || 'Resume';
    const email = (pc as any).email || '';
    const phone = (pc as any).phone || '';
    const contactParts = [name, email, phone].filter(Boolean);
    lines.push(contactParts.join(' | '));
    lines.push('');

    // Summary
    const summaryTexts = rewriteTexts['summary'] || [];
    const originalSummary = (pc as any).summary;
    if (summaryTexts.length > 0) {
      lines.push('PROFESSIONAL SUMMARY');
      lines.push('-'.repeat(20));
      for (const t of summaryTexts) {
        for (const line of t.split('\n')) {
          if (line.trim()) lines.push(line.trim());
        }
      }
      lines.push('');
    } else if (originalSummary) {
      lines.push('PROFESSIONAL SUMMARY');
      lines.push('-'.repeat(20));
      lines.push(originalSummary);
      lines.push('');
    }

    // Experience
    const expRewrite = rewriteTexts['experience'] || [];
    const expAdd = addTexts['experience'] || [];
    const experiences = (pc as any).experience || (pc as any).work_experience || [];
    if (experiences.length > 0 || expRewrite.length > 0 || expAdd.length > 0) {
      lines.push('EXPERIENCE');
      lines.push('-'.repeat(10));

      for (const exp of experiences) {
        const title = exp.title || exp.position || '';
        const company = exp.company || '';
        const dates = [exp.start_date, exp.end_date].filter(Boolean).join(' — ') || '';
        const location = exp.location || '';
        const headerParts = [title, company].filter(Boolean);
        lines.push(headerParts.join(' at '));
        if (location || dates) lines.push(`${location}${location && dates ? ' | ' : ''}${dates}`);
        if (exp.description) {
          for (const bullet of exp.description.split('\n')) {
            if (bullet.trim() && !removeKeys.has(bullet.trim().toLowerCase())) {
              lines.push(`  • ${bullet.trim()}`);
            }
          }
        }
        lines.push('');
      }

      // Add new experiences from suggestions
      for (const t of expRewrite) {
        for (const line of t.split('\n')) {
          if (line.trim()) lines.push(`  • ${line.trim()}`);
        }
      }
      for (const t of expAdd) {
        for (const line of t.split('\n')) {
          if (line.trim()) lines.push(`  • ${line.trim()}`);
        }
      }
    }

    // Skills
    const skillsRewrite = rewriteTexts['skills'] || [];
    const skillsAdd = addTexts['skills'] || [];
    const originalSkills = (pc as any).skills || resume?.skills || [];
    if (originalSkills.length > 0 || skillsAdd.length > 0) {
      lines.push('SKILLS');
      lines.push('-'.repeat(6));

      // Start with original skills, remove any that have "remove" suggestions
      let finalSkills = [...originalSkills];
      for (const r of accepted) {
        if (r.section === 'skills' && r.type === 'remove') {
          finalSkills = finalSkills.filter((s: string) => s.toLowerCase() !== r.original_text.toLowerCase());
        }
      }

      // Add new skills from suggestions
      for (const t of skillsRewrite) {
        for (const s of t.split(',')) {
          const trimmed = s.trim();
          if (trimmed && !finalSkills.includes(trimmed)) finalSkills.push(trimmed);
        }
      }
      for (const t of skillsAdd) {
        for (const s of t.split(',')) {
          const trimmed = s.trim();
          if (trimmed && !finalSkills.includes(trimmed)) finalSkills.push(trimmed);
        }
      }

      lines.push(finalSkills.join(', '));
      lines.push('');
    }

    // Education
    const eduRewrite = rewriteTexts['education'] || [];
    const eduAdd = addTexts['education'] || [];
    const education = (pc as any).education || [];
    if (education.length > 0 || eduAdd.length > 0) {
      lines.push('EDUCATION');
      lines.push('-'.repeat(9));
      for (const edu of education) {
        const degree = edu.degree || '';
        const field = edu.field || '';
        const institution = edu.institution || '';
        const gradDate = edu.graduation_date || '';
        lines.push([degree, field].filter(Boolean).join(' in ') + (institution ? ` — ${institution}` : ''));
        if (gradDate) lines.push(gradDate);
        lines.push('');
      }
      for (const t of eduRewrite) {
        if (t.trim()) lines.push(t.trim());
      }
      for (const t of eduAdd) {
        if (t.trim()) lines.push(t.trim());
      }
    }

    // Certifications
    const certs = (pc as any).certifications || [];
    if (certs.length > 0) {
      lines.push('CERTIFICATIONS');
      lines.push('-'.repeat(13));
      for (const c of certs) {
        lines.push(c.name || c || '');
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  analyze(): void {
    const resume = this.resume();
    if (!resume) return;

    const jobSkills = this.jobSkillsInput
      ? this.jobSkillsInput.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    this.isLoading.set(true);
    this.resumeService.tailorResume(resume.id, {
      job_title: this.jobTitle,
      job_description: this.jobDescription,
      job_skills: jobSkills,
    }).subscribe({
      next: (result) => {
        this.tailorResult.set(result);
        this.suggestionsList.set(result.suggestions.map(s => ({ ...s, accepted: false })));
        this.isLoading.set(false);
        this.snackBar.open('✅ Analysis complete! Review suggestions below.', 'Close', { duration: 4000 });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.snackBar.open('❌ ' + (err.error?.detail || 'AI analysis failed'), 'Close', { duration: 5000 });
      }
    });
  }

  saveTailored(): void {
    const resume = this.resume();
    if (!resume) return;

    const tailoredText = this.buildTailoredText();
    this.isSaving.set(true);

    this.resumeService.saveTailored(resume.id, tailoredText, this.jobTitle, resume.parsed_content?.raw_text || '').subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        const versionIndex = res.version_index ?? 0;
        this.router.navigate(['/resumes', resume.id, 'tailor', versionIndex, 'preview'], {
          state: {
            tailoredText,
            jobTitle: this.jobTitle,
            candidateName: resume.parsed_content?.full_name || resume.filename || 'Resume',
            resumeId: resume.id,
            versionIndex,
          }
        });
      },
      error: () => {
        this.isSaving.set(false);
        this.snackBar.open('❌ Failed to save tailored resume', 'Close', { duration: 3000 });
      }
    });
  }
}
