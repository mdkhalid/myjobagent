import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ResumeService } from '../../../core/services/resume.service';
import { AuthService } from '../../../core/services/auth.service';

export interface TailoredPreviewData {
  tailoredText: string;
  jobTitle: string;
  resumeId: string;
  versionIndex: number;
  downloadService: ResumeService;
}

interface TemplateOption {
  name: string;
  label: string;
  description: string;
}

const TEMPLATES: TemplateOption[] = [
  { name: 'professional', label: 'Professional', description: 'Classic ATS-friendly, blue accents' },
  { name: 'modern', label: 'Modern', description: 'Clean teal, left-bar sections' },
  { name: 'minimal', label: 'Minimal', description: 'Ultra-clean, maximum whitespace' },
  { name: 'executive', label: 'Executive', description: 'Premium navy & gold, bold header' },
];

@Component({
  selector: 'app-tailored-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule, MatTooltipModule, MatSnackBarModule, MatProgressSpinnerModule],
  template: `
    <div class="preview-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>check_circle</mat-icon>
          Resume Tailored Successfully
        </h2>
        <button mat-icon-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-divider></mat-divider>

      <div class="dialog-body">
        <p class="subtitle">
          Your resume has been tailored for <strong>{{ data.jobTitle }}</strong>.
          Pick a <strong>template</strong> and <strong>format</strong> to download.
        </p>

        <!-- Template Selection -->
        <div class="section-label">Choose Template</div>
        <div class="template-grid">
          <button class="template-card"
            *ngFor="let t of TEMPLATES"
            (click)="selectedTemplate.set(t.name)"
            [class.active]="selectedTemplate() === t.name">
            <div class="template-visual" [ngClass]="t.name">
              <div class="tv-header">{{ t.label }}</div>
              <div class="tv-body">
                <div class="tv-line" *ngFor="let _ of [1,2,3]"></div>
              </div>
            </div>
            <div class="template-info">
              <span class="template-name">{{ t.label }}</span>
              <span class="template-desc">{{ t.description }}</span>
            </div>
          </button>
        </div>

        <!-- Format Selection -->
        <div class="section-label">Download Format</div>
        <div class="format-options">
          <button class="format-btn"
            *ngFor="let f of FORMATS"
            (click)="selectedFmt.set(f.key)"
            [class.active]="selectedFmt() === f.key">
            <div class="format-icon" [ngClass]="f.key">
              <mat-icon>{{ f.icon }}</mat-icon>
            </div>
            <div class="format-info">
              <span class="format-name">{{ f.label }}</span>
              <span class="format-ext">{{ f.ext }}</span>
            </div>
            <mat-icon class="check-icon" *ngIf="selectedFmt() === f.key">check_circle</mat-icon>
          </button>
        </div>

        <mat-divider class="section-divider"></mat-divider>

        <p class="section-label">Preview</p>
        <div class="preview-box">
          <pre>{{ data.tailoredText }}</pre>
        </div>
      </div>

      <mat-divider></mat-divider>

      <div class="dialog-actions">
        <button mat-stroked-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
          Close
        </button>
        <button mat-raised-button color="primary" (click)="download()" [disabled]="isDownloading">
          <mat-icon *ngIf="!isDownloading">download</mat-icon>
          <mat-spinner *ngIf="isDownloading" diameter="18"></mat-spinner>
          {{ isDownloading ? 'Downloading...' : 'Download ' + selectedFmtLabel() }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .preview-dialog { padding: 0; }
    .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 8px;
      h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 18px; mat-icon { color: var(--success); } }
    }
    .dialog-body { padding: 16px 24px; }
    .subtitle { font-size: 14px; color: var(--text-secondary); margin-bottom: 20px; }
    .section-divider { margin: 16px 0; }
    .section-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }

    /* Template Grid */
    .template-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    .template-card {
      display: flex; flex-direction: column; gap: 8px;
      padding: 12px;
      border: 2px solid var(--border); border-radius: var(--radius-md);
      background: transparent; color: var(--text); cursor: pointer;
      transition: all var(--transition); text-align: left;
      &.active { border-color: var(--primary); background: rgba(99,102,241,0.06); }
      &:hover:not(.active) { border-color: var(--border-light); }
    }
    .template-visual {
      border-radius: 6px; overflow: hidden; height: 70px;
      padding: 8px;
      display: flex; flex-direction: column; gap: 3px;

      &.professional { background: #e8f0fe; .tv-header { color: #2563eb; } .tv-line { background: #93c5fd; } }
      &.modern { background: #f0fdfa; .tv-header { color: #0d9488; } .tv-line { background: #5eead4; } }
      &.minimal { background: #f8fafc; .tv-header { color: #475569; } .tv-line { background: #cbd5e1; } }
      &.executive { background: #1e293b; .tv-header { color: #f59e0b; } .tv-line { background: #475569; } }
    }
    .tv-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
    .tv-body { display: flex; flex-direction: column; gap: 2px; }
    .tv-line { height: 4px; border-radius: 2px; width: 100%; &:nth-child(2) { width: 80%; } &:nth-child(3) { width: 60%; } }
    .template-info { display: flex; flex-direction: column; gap: 2px; }
    .template-name { font-size: 13px; font-weight: 600; }
    .template-desc { font-size: 11px; color: var(--text-muted); }

    /* Format Options */
    .format-options { display: flex; flex-direction: row; gap: 10px; margin-bottom: 16px; }
    .format-btn {
      display: flex; align-items: center; gap: 10px; flex: 1;
      padding: 12px 14px;
      border: 2px solid var(--border); border-radius: var(--radius-md);
      background: transparent; color: var(--text); cursor: pointer;
      transition: all var(--transition); text-align: left;
      &.active { border-color: var(--primary); background: rgba(99,102,241,0.06); }
      &:hover:not(.active) { border-color: var(--border-light); }
    }
    .format-icon {
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.docx { background: rgba(41,101,241,0.12); color: #2971f1; }
      &.pdf { background: rgba(239,68,68,0.12); color: var(--warn); }
      &.txt { background: rgba(148,163,184,0.12); color: var(--text-secondary); }
    }
    .format-info { flex: 1; }
    .format-name { font-size: 13px; font-weight: 600; display: block; }
    .format-ext { font-size: 11px; color: var(--text-muted); }
    .check-icon { color: var(--primary); font-size: 18px; }

    .preview-box {
      max-height: 240px; overflow-y: auto;
      background: rgba(0,0,0,0.2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: 14px;
      pre { margin: 0; font-size: 12px; line-height: 1.5; white-space: pre-wrap; color: var(--text); font-family: 'Consolas', 'Courier New', monospace; }
    }
    .dialog-actions {
      display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px;
      button { display: flex; align-items: center; gap: 8px; }
      mat-spinner { --mdc-circular-progress-active-indicator-color: white; }
    }
  `]
})
export class TailoredPreviewDialog {
  readonly data = inject<TailoredPreviewData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<TailoredPreviewDialog>);
  readonly http = inject(HttpClient);
  readonly snackBar = inject(MatSnackBar);

  readonly TEMPLATES = TEMPLATES;
  readonly FORMATS = [
    { key: 'pdf', label: 'PDF', ext: '.pdf', icon: 'picture_as_pdf' },
    { key: 'docx', label: 'Word', ext: '.docx', icon: 'description' },
    { key: 'txt', label: 'Text', ext: '.txt', icon: 'text_snippet' },
  ];

  selectedTemplate = signal('professional');
  selectedFmt = signal('pdf');
  isDownloading = false;

  selectedFmtLabel = () => {
    const f = this.FORMATS.find(x => x.key === this.selectedFmt());
    return f ? `${f.label} (${f.ext})` : '';
  };

  download(): void {
    this.isDownloading = true;
    const url = this.data.downloadService.downloadTailored(
      this.data.resumeId,
      this.data.versionIndex,
      this.selectedFmt(),
      this.selectedTemplate(),
    );

    // Use HttpClient so the auth interceptor attaches the Bearer token
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.isDownloading = false;
        const detectedFmt = this.selectedFmt();
        const extMap: Record<string, string> = {
          pdf: 'application/pdf',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          txt: 'text/plain',
        };
        const mimeType = extMap[detectedFmt] || 'application/octet-stream';

        const blobWithType = new Blob([blob], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blobWithType);
        link.download = `tailored_resume_${this.data.jobTitle.replace(/[^a-z0-9]/gi, '_')}.${detectedFmt}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      },
      error: (err) => {
        this.isDownloading = false;
        this.snackBar.open('❌ Download failed — ' + (err.statusText || 'server error'), 'Close', { duration: 5000 });
      },
    });
  }
}
