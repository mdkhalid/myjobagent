import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface TemplateInfo {
  name: string; label: string; description: string;
  colors: { primary: string; accent: string; bg: string; text: string };
  sectionStyle: string;
}

const TEMPLATES: TemplateInfo[] = [
  { name: 'professional', label: 'Professional', description: 'Classic ATS-friendly, blue accents',
    colors: { primary: '#2563eb', accent: '#3b82f6', bg: '#ffffff', text: '#1e293b' }, sectionStyle: 'underline' },
  { name: 'modern', label: 'Modern', description: 'Clean teal, left-bar sections',
    colors: { primary: '#0d9488', accent: '#14b8a6', bg: '#fafafa', text: '#1e293b' }, sectionStyle: 'bar' },
  { name: 'minimal', label: 'Minimal', description: 'Ultra-clean, maximum whitespace',
    colors: { primary: '#475569', accent: '#94a3b8', bg: '#ffffff', text: '#334155' }, sectionStyle: 'minimal' },
  { name: 'executive', label: 'Executive', description: 'Premium navy & gold, bold header',
    colors: { primary: '#1e293b', accent: '#f59e0b', bg: '#f8fafc', text: '#1e293b' }, sectionStyle: 'badge' },
];

@Component({
  selector: 'app-resume-preview',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatDividerModule, MatSnackBarModule,
  ],
  template: `
    <div class="preview-page">
      <!-- Top bar -->
      <div class="top-bar">
        <button mat-stroked-button routerLink="/resumes">
          <mat-icon>arrow_back</mat-icon> Back to Resumes
        </button>
        <span class="top-title">Resume Preview — {{ data().jobTitle }}</span>
        <div class="top-actions">
          <button mat-raised-button color="primary" (click)="download()" [disabled]="isDownloading">
            <mat-icon *ngIf="!isDownloading">download</mat-icon>
            <mat-spinner *ngIf="isDownloading" diameter="18"></mat-spinner>
            Download {{ fmtLabel() }}
          </button>
        </div>
      </div>

      <div class="preview-layout">
        <!-- Sidebar -->
        <aside class="sidebar">
          <div class="sidebar-section">
            <h3>Template</h3>
            <div class="template-list">
              <button class="tpl-card"
                *ngFor="let t of TEMPLATES"
                (click)="selectedTemplate.set(t.name)"
                [class.active]="selectedTemplate() === t.name">
                <div class="tpl-swatch" [style.background]="t.colors.bg" [style.border-color]="t.colors.primary">
                  <div class="swatch-head" [style.background]="t.colors.primary"></div>
                  <div class="swatch-body">
                    <div class="swatch-line" *ngFor="let _ of [1,2,3]" [style.background]="t.colors.accent + '40'"></div>
                  </div>
                </div>
                <span class="tpl-label">{{ t.label }}</span>
              </button>
            </div>
          </div>

          <mat-divider></mat-divider>

          <div class="sidebar-section">
            <h3>Format</h3>
            <div class="fmt-list">
              <button class="fmt-btn" *ngFor="let f of FORMATS"
                (click)="selectedFmt.set(f.key)"
                [class.active]="selectedFmt() === f.key">
                <mat-icon>{{ f.icon }}</mat-icon> {{ f.label }}
              </button>
            </div>
          </div>

          <mat-divider></mat-divider>

          <div class="sidebar-section">
            <h3>Actions</h3>
            <button mat-raised-button color="primary" class="dl-btn" (click)="download()" [disabled]="isDownloading">
              <mat-icon>download</mat-icon> Download
            </button>
          </div>
        </aside>

        <!-- Resume preview -->
        <main class="preview-area">
          <div class="resume-page" [style.background]="template().colors.bg" [style.color]="template().colors.text">
            <div class="rp-header" [style.text-align]="template().name === 'professional' || template().name === 'executive' ? 'center' : 'left'">
              <h1 class="rp-name" [style.color]="template().colors.primary">{{ data().candidateName }}</h1>
              <div class="rp-subtitle" *ngIf="data().jobTitle" [style.color]="template().colors.accent">
                Tailored for: {{ data().jobTitle }}
              </div>
              <div class="rp-divider" *ngIf="template().name === 'professional' || template().name === 'executive'"
                [style.background]="template().colors.accent"></div>
            </div>

            <div class="rp-body">
              @for (section of parsedSections(); track $index) {
                @switch (template().sectionStyle) {
                  @case ('bar') {
                    <div class="section-bar" [style.border-left-color]="template().colors.accent">
                      <h2 class="section-title" [style.color]="template().colors.primary">{{ section.heading }}</h2>
                    </div>
                  }
                  @case ('badge') {
                    <div class="section-badge" [style.background]="template().colors.accent"><span>{{ section.heading }}</span></div>
                  }
                  @case ('minimal') {
                    <h2 class="section-title section-minimal" [style.color]="template().colors.primary">{{ section.heading }}</h2>
                  }
                  @default {
                    <h2 class="section-title" [style.color]="template().colors.primary">{{ section.heading }}</h2>
                    <div class="section-underline" [style.background]="template().colors.accent"></div>
                  }
                }
                <div class="section-body">
                  @for (line of section.lines; track $index) {
                    <p>{{ line }}</p>
                  }
                </div>
              }
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .preview-page { display: flex; flex-direction: column; height: 100vh; background: var(--bg); }
    .top-bar { display: flex; align-items: center; gap: 16px; padding: 12px 24px; background: rgba(15,23,42,0.95); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; }
    .top-title { flex: 1; font-weight: 600; font-size: 15px; color: var(--text); }
    .top-actions button { display: flex; align-items: center; gap: 6px; }
    .top-actions mat-spinner { --mdc-circular-progress-active-indicator-color: white; }
    .preview-layout { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 220px; flex-shrink: 0; background: rgba(15,23,42,0.6); border-right: 1px solid var(--border); padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
    .sidebar-section h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 10px; }
    .template-list { display: flex; flex-direction: column; gap: 8px; }
    .tpl-card { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: var(--radius-md); border: 2px solid transparent; background: transparent; cursor: pointer; transition: all var(--transition); text-align: left; &.active { border-color: var(--primary); background: rgba(99,102,241,0.08); } &:hover:not(.active) { border-color: var(--border); } }
    .tpl-swatch { width: 44px; height: 52px; border-radius: 6px; border: 1px solid; overflow: hidden; flex-shrink: 0; display: flex; flex-direction: column; padding: 4px; gap: 3px; }
    .swatch-head { height: 8px; border-radius: 2px; }
    .swatch-body { display: flex; flex-direction: column; gap: 2px; }
    .swatch-line { height: 3px; border-radius: 1px; }
    .tpl-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .fmt-list { display: flex; flex-direction: column; gap: 6px; }
    .fmt-btn { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 13px; transition: all var(--transition); &.active { border-color: var(--primary); color: var(--primary-light); background: rgba(99,102,241,0.06); } &:hover:not(.active) { border-color: var(--border-light); } mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    .dl-btn { width: 100%; display: flex; align-items: center; gap: 8px; justify-content: center; }
    .preview-area { flex: 1; overflow-y: auto; padding: 32px; display: flex; justify-content: center; background: #e2e8f0; }
    .resume-page { width: 800px; min-height: 1100px; padding: 48px 56px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; line-height: 1.5; }
    .rp-header { margin-bottom: 24px; }
    .rp-name { font-size: 26px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.01em; }
    .rp-subtitle { font-size: 12px; font-style: italic; margin-bottom: 8px; }
    .rp-divider { height: 2px; width: 60px; margin: 8px auto; border-radius: 1px; }
    .rp-body { font-size: 13px; }
    .section-title { font-size: 15px; font-weight: 700; margin: 20px 0 8px; }
    .section-minimal { margin-bottom: 4px; }
    .section-underline { height: 1px; margin-bottom: 12px; }
    .section-bar { border-left: 3px solid; padding-left: 10px; margin: 20px 0 8px; }
    .section-badge { display: inline-block; padding: 4px 14px; border-radius: 4px; margin: 20px 0 12px; font-size: 13px; font-weight: 700; color: white; }
    .section-body p { margin: 0 0 6px; }
  `]
})
export class ResumePreviewComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  readonly TEMPLATES = TEMPLATES;
  readonly FORMATS = [
    { key: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
    { key: 'docx', label: 'Word', icon: 'description' },
    { key: 'txt', label: 'Text', icon: 'text_snippet' },
  ];

  selectedTemplate = signal('professional');
  selectedFmt = signal('pdf');
  isDownloading = false;

  /** Data passed via router state from the tailor page */
  data = signal<{ tailoredText: string; jobTitle: string; candidateName: string; resumeId: string; versionIndex: number }>({
    tailoredText: '', jobTitle: '', candidateName: 'Resume', resumeId: '', versionIndex: 0,
  });

  template = computed(() => TEMPLATES.find(t => t.name === this.selectedTemplate()) || TEMPLATES[0]);
  fmtLabel = () => this.FORMATS.find(f => f.key === this.selectedFmt())?.label || 'PDF';

  parsedSections = computed(() => {
    const text = this.data().tailoredText;
    if (!text) return [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const sections: { heading: string; lines: string[] }[] = [];
    let current: { heading: string; lines: string[] } | null = null;
    for (const line of lines) {
      const stripped = line.replace(/^=+\s*|\s*=+$/g, '');
      if (line.startsWith('=') || (line === line.toUpperCase() && line.length > 2 && !line.includes('—') && !line.includes('·'))) {
        current = { heading: stripped || line, lines: [] };
        sections.push(current);
      } else if (current) {
        current.lines.push(line);
      } else {
        sections.push({ heading: '', lines: [line] });
      }
    }
    return sections;
  });

  constructor() {
    const state = this.router.getCurrentNavigation()?.extras.state as any;
    if (state?.tailoredText) {
      this.data.set(state);
    } else {
      this.snackBar.open('No resume data available', 'Close', { duration: 3000 });
      this.router.navigate(['/resumes']);
    }
  }

  download(): void {
    this.isDownloading = true;
    const d = this.data();
    const url = `/api/v1/tailor/${d.resumeId}/tailored/${d.versionIndex}/download?fmt=${this.selectedFmt()}&template=${this.selectedTemplate()}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.isDownloading = false;
        const mimeMap: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([blob], { type: mimeMap[this.selectedFmt()] || 'application/octet-stream' }));
        a.download = `resume_${d.jobTitle.replace(/[^a-z0-9]/gi, '_') || 'tailored'}.${this.selectedFmt()}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        this.snackBar.open('✅ Downloaded successfully', 'Close', { duration: 3000 });
      },
      error: () => {
        this.isDownloading = false;
        this.snackBar.open('❌ Download failed', 'Close', { duration: 3000 });
      },
    });
  }
}
