import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ResumeService, Resume } from '../../../core/services/resume.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/dialogs/confirm-dialog.component';

@Component({
  selector: 'app-resume-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="resume-page">
      <div class="header">
        <h1>My Resumes</h1>
        <input 
          type="file" 
          #fileInput 
          hidden 
          accept=".pdf,.doc,.docx"
          (change)="onFileSelected($event)">
        <button mat-raised-button color="primary" (click)="fileInput.click()">
          <mat-icon>upload</mat-icon>
          Upload Resume
        </button>
      </div>

      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!isLoading && resumes.length === 0" class="empty-state">
        <mat-icon>description</mat-icon>
        <h2>No resumes uploaded yet</h2>
        <p>Upload your resume to start applying for jobs</p>
        <button mat-raised-button color="primary" (click)="fileInput.click()">
          Upload Resume
        </button>
      </div>

      <div *ngIf="!isLoading && resumes.length > 0" class="resume-grid">
        <mat-card *ngFor="let resume of resumes" class="resume-card" [class.active]="resume.is_active">
          <mat-card-header>
            <mat-card-title>
              <div class="title-row">
                <mat-icon>description</mat-icon>
                <span class="filename-text">{{ resume.filename }}</span>
                <span *ngIf="resume.is_active" class="active-badge">ACTIVE</span>
              </div>
            </mat-card-title>
            <mat-card-subtitle>
              Uploaded {{ resume.created_at | date:'mediumDate' }}
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <div class="resume-stats">
              <div class="stat">
                <span class="stat-value">{{ (resume.skills || []).length }}</span>
                <span class="stat-label">Skills</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ resume.experience_years || 0 }}</span>
                <span class="stat-label">Years Exp</span>
              </div>
            </div>

            <div class="skills-section" *ngIf="resume.skills?.length">
              <h4>Top Skills</h4>
              <mat-chip-set>
                <mat-chip *ngFor="let skill of resume.skills.slice(0, 8)">{{ skill }}</mat-chip>
              </mat-chip-set>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <button 
              mat-button 
              color="primary" 
              (click)="setActive(resume)"
              *ngIf="!resume.is_active">
              <mat-icon>check_circle</mat-icon>
              Set Active
            </button>
            <button mat-button color="warn" (click)="openDeleteDialog(resume)">
              <mat-icon>delete</mat-icon>
              Delete
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .resume-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 500;
      }

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .empty-state {
      text-align: center;
      padding: 80px 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);

      mat-icon {
        font-size: 80px;
        width: 80px;
        height: 80px;
        color: #aaa;
      }

      h2 {
        margin: 16px 0 8px;
        color: #333;
        font-weight: 500;
      }

      p {
        color: #777;
        margin-bottom: 24px;
      }
    }

    .resume-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }

    .resume-card {
      border-radius: 12px;
      transition: box-shadow 0.25s ease;

      &.active {
        border: 2px solid #4caf50;
      }

      &:hover {
        box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      }

      mat-card-header {
        padding: 20px 20px 8px;
        overflow: hidden;
      }

      mat-card-title {
        display: block;
        overflow: hidden;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-width: 0;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          color: #555;
        }

        .filename-text {
          flex: 1;
          min-width: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.35;
          word-break: break-word;
        }

        .active-badge {
          flex-shrink: 0;
          background: linear-gradient(135deg, #43a047, #66bb6a);
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          letter-spacing: 0.5px;
        }
      }

      mat-card-subtitle {
        font-size: 12px;
      }
    }

    .resume-stats {
      display: flex;
      gap: 24px;
      margin: 8px 0 16px;
      padding: 16px 20px;
      background-color: #f8f9fa;
      border-radius: 10px;

      .stat {
        flex: 1;
        text-align: center;

        .stat-value {
          display: block;
          font-size: 26px;
          font-weight: 700;
          color: #1976d2;
        }

        .stat-label {
          font-size: 12px;
          color: #777;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
        }
      }
    }

    .skills-section {
      margin-bottom: 8px;

      h4 {
        margin: 0 0 10px;
        font-size: 13px;
        color: #777;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      }
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      padding: 8px 16px 16px;
    }
  `]
})
export class ResumeListComponent implements OnInit {
  private resumeService = inject(ResumeService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  resumes: Resume[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadResumes();
  }

  loadResumes(): void {
    this.isLoading = true;
    this.resumeService.getResumes().subscribe({
      next: (resumes) => {
        this.resumes = resumes;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.uploadResume(file);
    }
  }

  uploadResume(file: File): void {
    this.isLoading = true;
    this.resumeService.uploadResume(file).subscribe({
      next: () => {
        this.snackBar.open('Resume uploaded successfully', 'Close', { duration: 3000 });
        this.loadResumes();
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to upload resume', 'Close', { duration: 3000 });
      }
    });
  }

  setActive(resume: Resume): void {
    this.resumeService.setActiveResume(resume.id).subscribe({
      next: () => {
        this.snackBar.open('Resume set as active', 'Close', { duration: 3000 });
        this.loadResumes();
      },
      error: () => {
        this.snackBar.open('Failed to set resume as active', 'Close', { duration: 3000 });
      }
    });
  }

  openDeleteDialog(resume: Resume): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Resume',
        message: `Are you sure you want to delete "${resume.filename}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        icon: 'delete_forever',
        confirmColor: 'warn'
      } as ConfirmDialogData
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.deleteResume(resume);
      }
    });
  }

  private deleteResume(resume: Resume): void {
    this.resumeService.deleteResume(resume.id).subscribe({
      next: () => {
        this.snackBar.open('Resume deleted successfully', 'Close', { duration: 3000 });
        this.loadResumes();
      },
      error: () => {
        this.snackBar.open('Failed to delete resume', 'Close', { duration: 3000 });
      }
    });
  }
}
