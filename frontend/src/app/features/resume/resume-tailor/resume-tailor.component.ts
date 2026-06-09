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
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ResumeService, Resume, TailorResponse, Suggestion, AtsScore, AtsCategoryScores } from '../../../core/services/resume.service';

interface SuggestionWithState extends Suggestion {
  accepted: boolean;
}

@Component({
  selector: 'app-resume-tailor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatSnackBarModule, MatDividerModule, MatFormFieldModule, MatInputModule,
  ],
  template: `
    <div class="tailor-page">
      <!-- Header -->
      <div class="header">
        <button mat-stroked-button routerLink="/resumes">
          <mat-icon>arrow_back</mat-icon> Back to Resumes
        </button>
        <h1>Resume Tailor</h1>
        <div></div>
      </div>

      <!-- Step 1: JD Input -->
      <mat-card class="jd-card glass-card fade-in" *ngIf="stage() === 'input'">
        <mat-card-header>
          <mat-card-title><mat-icon>work</mat-icon> Enter Job Description</mat-card-title>
          <mat-card-subtitle>Paste a job description to tailor "{{ resume()?.filename }}"</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="jd-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Job Title</mat-label>
              <input matInput [(ngModel)]="jobTitle" placeholder="e.g. Senior Frontend Engineer">
            </mat-form-field>
            <div class="job-suggestions">
              <span class="js-label">Quick pick:</span>
              <button class="js-chip" *ngFor="let jt of JOB_TITLES" (click)="jobTitle = jt; jobTitle = jt">{{ jt }}</button>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Job Description</mat-label>
              <textarea matInput [(ngModel)]="jobDescription" rows="10"
                placeholder="Paste the full job description here..."></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Required Skills (optional, comma-separated)</mat-label>
              <input matInput [(ngModel)]="jobSkillsInput" placeholder="e.g. React, TypeScript, AWS">
            </mat-form-field>
            <div class="jd-actions">
              <button mat-raised-button color="primary" (click)="analyze()"
                [disabled]="!jobTitle || !jobDescription || isLoading()" class="action-btn">
                <mat-icon *ngIf="!isLoading()">auto_awesome</mat-icon>
                <mat-spinner *ngIf="isLoading()" diameter="20"></mat-spinner>
                {{ isLoading() ? 'Analyzing...' : 'Analyze Resume' }}
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Step 2: Review Changes -->
      <ng-container *ngIf="stage() === 'review'">
        <!-- ATS Score Bar (compact) -->
        <mat-card class="ats-bar fade-in" [ngClass]="scoreClass()">
          <mat-card-content>
            <div class="ats-inner">
              <div class="ats-ring">
                <svg width="48" height="48" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="white" stroke-width="3"
                    [attr.stroke-dasharray]="97.4"
                    [attr.stroke-dashoffset]="97.4 - (97.4 * atsScore().overall / 100)"
                    stroke-linecap="round"/>
                </svg>
                <span class="ats-score-text">{{ atsScore().overall | number:'1.0-0' }}</span>
              </div>
              <div class="ats-info">
                <strong>ATS Score: {{ atsScore().overall | number:'1.0-0' }}/100</strong>
                <div class="ats-cats">
                  <span class="ats-cat" *ngFor="let cat of categoryKeys">
                    {{ cat | titlecase }}: {{ atsScore().categories[cat] | number:'1.0-0' }}%
                  </span>
                </div>
              </div>
              <div class="ats-meta">
                <span class="ats-chips" *ngIf="atsScore().missing_keywords?.length">
                  <mat-icon>priority_high</mat-icon> {{ atsScore().missing_keywords.length }} missing keywords
                </span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Full Resume Preview -->
        <mat-card class="glass-card fade-in resume-preview-card">
          <mat-card-header>
            <mat-card-title><mat-icon>description</mat-icon> Tailored Resume Preview</mat-card-title>
            <mat-card-subtitle>
              {{ acceptedCount() }} / {{ suggestionsList().length }} changes accepted —
              <a (click)="acceptAll()" class="inline-link">Accept all</a> ·
              <a (click)="rejectAll()" class="inline-link">Clear all</a>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="resume-preview-box">
              <pre>{{ tailoredTextPreview() }}</pre>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Change Items -->
        <mat-card class="glass-card fade-in changes-card">
          <mat-card-header>
            <mat-card-title><mat-icon>edit_note</mat-icon> Individual Changes</mat-card-title>
            <mat-card-subtitle>Toggle each change on or off — the preview above updates in real time</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="changes-grid">
              <div class="change-item" *ngFor="let sugg of suggestionsList(); let i = index"
                [class.accepted]="sugg.accepted" (click)="toggleSuggestion(sugg)">
                <div class="change-header">
                  <mat-icon class="change-icon">{{ sugg.accepted ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <span class="change-type" [ngClass]="sugg.type">{{ sugg.type | titlecase }}</span>
                  <span class="change-section">{{ sugg.section | titlecase }}</span>
                  <span class="change-reason">{{ sugg.reason }}</span>
                </div>
                <div class="change-text" *ngIf="sugg.type !== 'remove'">
                  <div class="ct-label">New text:</div>
                  <div class="ct-content">{{ sugg.suggested_text }}</div>
                </div>
                <div class="change-text original" *ngIf="sugg.original_text && sugg.type !== 'add'">
                  <div class="ct-label">Original:</div>
                  <div class="ct-content strikethrough">{{ sugg.original_text }}</div>
                </div>
              </div>
            </div>

            <div class="changes-actions">
              <button mat-stroked-button (click)="acceptAll()"><mat-icon>select_all</mat-icon> Accept All</button>
              <button mat-stroked-button (click)="rejectAll()"><mat-icon>deselect</mat-icon> Clear All</button>
              <span class="spacer"></span>
              <span class="accept-count">{{ acceptedCount() }} / {{ suggestionsList().length }} accepted</span>
              <button mat-raised-button color="primary" (click)="saveAndPreview()"
                [disabled]="acceptedCount() === 0 || isSaving()" class="action-btn">
                <mat-icon *ngIf="!isSaving()">arrow_forward</mat-icon>
                <mat-spinner *ngIf="isSaving()" diameter="20"></mat-spinner>
                {{ isSaving() ? 'Saving...' : 'Continue to Download' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </ng-container>
    </div>
  `,
  styles: [`
    .tailor-page { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; h1 { margin: 0; font-size: 26px; font-weight: 500; } }
    .jd-card mat-card-header mat-icon { color: var(--primary-light); }
    .jd-form { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; }
    .job-suggestions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: -6px; }
    .js-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .js-chip { font-size: 11px; padding: 3px 10px; border-radius: 12px; border: 1px solid var(--border); background: transparent; color: var(--text-secondary); cursor: pointer; transition: all var(--transition); white-space: nowrap; &:hover { border-color: var(--primary); color: var(--primary-light); background: rgba(99,102,241,0.06); } }
    .jd-actions { display: flex; justify-content: flex-end; }
    .action-btn { display: flex; align-items: center; gap: 8px; padding: 8px 28px; mat-spinner { --mdc-circular-progress-active-indicator-color: white; } }

    /* ATS Bar */
    .ats-bar { margin-bottom: 20px; border-left: 4px solid; &.high { border-color: var(--success); } &.medium { border-color: var(--warning); } &.low { border-color: var(--warn); } }
    .ats-inner { display: flex; align-items: center; gap: 20px; }
    .ats-ring { position: relative; width: 48px; height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .ats-score-text { position: absolute; font-size: 14px; font-weight: 800; }
    .ats-info { flex: 1; strong { font-size: 15px; } }
    .ats-cats { display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
    .ats-cat { font-size: 11px; background: rgba(148,163,184,0.1); padding: 2px 8px; border-radius: 4px; }
    .ats-meta { flex-shrink: 0; }
    .ats-chips { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--warn); mat-icon { font-size: 16px; width: 16px; height: 16px; } }

    /* Resume Preview */
    .resume-preview-card { margin-bottom: 20px; }
    .resume-preview-box { max-height: 500px; overflow-y: auto; background: rgba(0,0,0,0.15); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; pre { margin: 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; font-family: 'Consolas', 'Courier New', monospace; color: var(--text); } }
    .inline-link { color: var(--primary-light); cursor: pointer; text-decoration: underline; font-weight: 500; }

    /* Changes */
    .changes-card { margin-bottom: 20px; }
    .changes-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .change-item { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; cursor: pointer; transition: all var(--transition); &.accepted { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.03); } &:hover { border-color: var(--border-light); } }
    .change-header { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .change-icon { font-size: 20px; width: 20px; height: 20px; color: var(--text-muted); .accepted & { color: var(--success); } }
    .change-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 4px; &.rewrite { background: rgba(99,102,241,0.1); color: var(--primary-light); } &.add { background: rgba(34,197,94,0.1); color: var(--success); } &.remove { background: rgba(239,68,68,0.1); color: var(--warn); } }
    .change-section { font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 4px; background: rgba(148,163,184,0.08); color: var(--text-secondary); }
    .change-reason { flex: 1; font-size: 11px; color: var(--text-muted); font-style: italic; min-width: 80px; }
    .change-text { margin-top: 8px; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 12px; line-height: 1.4; &.original { background: rgba(239,68,68,0.04); } &:not(.original) { background: rgba(34,197,94,0.04); } }
    .ct-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; color: var(--text-muted); }
    .ct-content { &.strikethrough { color: var(--warn); text-decoration: line-through; opacity: 0.7; } }
    .changes-actions { display: flex; align-items: center; gap: 8px; padding-top: 16px; border-top: 1px solid var(--border); button { display: flex; align-items: center; gap: 6px; } mat-spinner { --mdc-circular-progress-active-indicator-color: white; } }
    .accept-count { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin: 0 8px; }
    .spacer { flex: 1; }
  `]
})
export class ResumeTailorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private resumeService = inject(ResumeService);
  private snackBar = inject(MatSnackBar);

  resume = signal<Resume | null>(null);
  stage = signal<'input' | 'review'>('input');
  isLoading = signal(false);
  isSaving = signal(false);
  tailorResult = signal<TailorResponse | null>(null);
  suggestionsList = signal<SuggestionWithState[]>([]);

  readonly JOB_TITLES = [
    'Senior Frontend Engineer',
    'Senior Backend Engineer',
    'Full Stack Developer',
    'Software Engineer',
    'DevOps Engineer',
    'Data Scientist',
    'Product Manager',
    'Engineering Manager',
    'QA Engineer',
    'Solutions Architect',
    'iOS Developer',
    'Android Developer',
    'Machine Learning Engineer',
  ];

  jobTitle = '';
  jobDescription = '';
  jobSkillsInput = '';

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
        else { this.snackBar.open('Resume not found', 'Close', { duration: 3000 }); this.router.navigate(['/resumes']); }
      },
      error: () => { this.snackBar.open('Failed to load resume', 'Close', { duration: 3000 }); this.router.navigate(['/resumes']); }
    });
  }

  atsScore = computed<AtsScore>(() => this.tailorResult()?.ats_score || {
    overall: 0,
    categories: { keywords: 0, formatting: 0, experience: 0, education: 0, skills: 0 },
    strengths: [], improvements: [], missing_keywords: []
  });

  scoreClass = computed(() => { const s = this.atsScore().overall; return s >= 80 ? 'high' : s >= 60 ? 'medium' : 'low'; });
  acceptedCount = computed(() => this.suggestionsList().filter(s => s.accepted).length);

  /** Full preview text updated whenever suggestions change */
  tailoredTextPreview = computed(() => this.buildTailoredText());

  toggleSuggestion(sugg: SuggestionWithState): void {
    sugg.accepted = !sugg.accepted;
    this.suggestionsList.set([...this.suggestionsList()]);
  }

  acceptAll(): void {
    this.suggestionsList().forEach(s => s.accepted = true);
    this.suggestionsList.set([...this.suggestionsList()]);
    this.snackBar.open(`✅ ${this.suggestionsList().length} changes accepted`, 'Close', { duration: 2000 });
  }

  rejectAll(): void {
    this.suggestionsList().forEach(s => s.accepted = false);
    this.suggestionsList.set([...this.suggestionsList()]);
    this.snackBar.open('All changes cleared', 'Close', { duration: 2000 });
  }

  analyze(): void {
    const resume = this.resume();
    if (!resume) return;
    const jobSkills = this.jobSkillsInput ? this.jobSkillsInput.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    this.isLoading.set(true);
    this.resumeService.tailorResume(resume.id, { job_title: this.jobTitle, job_description: this.jobDescription, job_skills: jobSkills }).subscribe({
      next: (result) => {
        this.tailorResult.set(result);
        this.suggestionsList.set(result.suggestions.map(s => ({ ...s, accepted: true }))); // auto-accept all
        this.isLoading.set(false);
        this.stage.set('review');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.snackBar.open('❌ ' + (err.error?.detail || 'AI analysis failed'), 'Close', { duration: 5000 });
      }
    });
  }

  saveAndPreview(): void {
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
            tailoredText, jobTitle: this.jobTitle,
            candidateName: resume.parsed_content?.full_name || resume.filename || 'Resume',
            filename: resume.filename, resumeId: resume.id, versionIndex,
          }
        });
      },
      error: () => { this.isSaving.set(false); this.snackBar.open('❌ Failed to save', 'Close', { duration: 3000 }); }
    });
  }

  private buildTailoredText(): string {
    const resume = this.resume();
    const pc = resume?.parsed_content || {};
    const accepted = this.suggestionsList().filter(s => s.accepted);
    const addTexts: Record<string, string[]> = {};
    const rewriteTexts: Record<string, string[]> = {};
    const removeKeys: Set<string> = new Set();
    for (const s of accepted) {
      if (s.type === 'add') (addTexts[s.section] = addTexts[s.section] || []).push(s.suggested_text);
      else if (s.type === 'rewrite') (rewriteTexts[s.section] = rewriteTexts[s.section] || []).push(s.suggested_text);
      else if (s.type === 'remove') removeKeys.add(s.original_text.toLowerCase().trim());
    }
    const lines: string[] = [];
    const name = (pc as any).full_name || resume?.filename?.replace(/\.[^.]+$/, '') || 'Resume';
    const email = (pc as any).email || '';
    const phone = (pc as any).phone || '';
    lines.push([name, email, phone].filter(Boolean).join(' | '));
    lines.push('');
    // Summary
    const sTexts = rewriteTexts['summary'] || [];
    const origSum = (pc as any).summary;
    if (sTexts.length > 0) { lines.push('PROFESSIONAL SUMMARY', '-'.repeat(20)); for (const t of sTexts) for (const l of t.split('\n')) if (l.trim()) lines.push(l.trim()); lines.push(''); }
    else if (origSum) { lines.push('PROFESSIONAL SUMMARY', '-'.repeat(20), origSum, ''); }
    // Experience
    const expRewrite = rewriteTexts['experience'] || [];
    const expAdd = addTexts['experience'] || [];
    const experiences = (pc as any).experience || (pc as any).work_experience || [];
    if (experiences.length > 0 || expRewrite.length > 0 || expAdd.length > 0) {
      lines.push('EXPERIENCE', '-'.repeat(10));
      for (const exp of experiences) {
        const title = exp.title || exp.position || '';
        const company = exp.company || '';
        const dates = [exp.start_date, exp.end_date].filter(Boolean).join(' — ') || '';
        const location = exp.location || '';
        lines.push([title, company].filter(Boolean).join(' at '));
        if (location || dates) lines.push(`${location}${location && dates ? ' | ' : ''}${dates}`);
        if (exp.description) for (const bullet of exp.description.split('\n')) if (bullet.trim() && !removeKeys.has(bullet.trim().toLowerCase())) lines.push(`  • ${bullet.trim()}`);
        lines.push('');
      }
      for (const t of expRewrite) for (const l of t.split('\n')) if (l.trim()) lines.push(`  • ${l.trim()}`);
      for (const t of expAdd) for (const l of t.split('\n')) if (l.trim()) lines.push(`  • ${l.trim()}`);
    }
    // Skills
    const skillsRewrite = rewriteTexts['skills'] || [];
    const skillsAdd = addTexts['skills'] || [];
    const originalSkills = (pc as any).skills || resume?.skills || [];
    if (originalSkills.length > 0 || skillsAdd.length > 0) {
      lines.push('SKILLS', '-'.repeat(6));
      let finalSkills = [...originalSkills];
      for (const r of accepted) if (r.section === 'skills' && r.type === 'remove') finalSkills = finalSkills.filter((s: string) => s.toLowerCase() !== r.original_text.toLowerCase());
      for (const t of skillsRewrite) for (const s of t.split(',')) { const tr = s.trim(); if (tr && !finalSkills.includes(tr)) finalSkills.push(tr); }
      for (const t of skillsAdd) for (const s of t.split(',')) { const tr = s.trim(); if (tr && !finalSkills.includes(tr)) finalSkills.push(tr); }
      lines.push(finalSkills.join(', '), '');
    }
    // Education
    const eduRewrite = rewriteTexts['education'] || [];
    const eduAdd = addTexts['education'] || [];
    const education = (pc as any).education || [];
    if (education.length > 0 || eduAdd.length > 0) {
      lines.push('EDUCATION', '-'.repeat(9));
      for (const edu of education) {
        const degree = edu.degree || ''; const field = edu.field || ''; const inst = edu.institution || ''; const gd = edu.graduation_date || '';
        lines.push([degree, field].filter(Boolean).join(' in ') + (inst ? ` — ${inst}` : ''));
        if (gd) lines.push(gd); lines.push('');
      }
      for (const t of eduRewrite) if (t.trim()) lines.push(t.trim());
      for (const t of eduAdd) if (t.trim()) lines.push(t.trim());
    }
    // Certifications
    const certs = (pc as any).certifications || [];
    if (certs.length > 0) { lines.push('CERTIFICATIONS', '-'.repeat(13)); for (const c of certs) lines.push(c.name || c || ''); lines.push(''); }
    return lines.join('\n');
  }
}
