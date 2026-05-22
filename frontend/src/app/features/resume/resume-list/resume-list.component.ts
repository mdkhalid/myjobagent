import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ResumeService, Resume } from '../../../core/services/resume.service';

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
    MatProgressSpinnerModule
  ],
  template: `
    <div class="container">
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
              <mat-icon>description</mat-icon>
              {{ resume.filename }}
              <span *ngIf="resume.is_active" class="active-badge">ACTIVE</span>
            </mat-card-title>
            <mat-card-subtitle>
              Uploaded {{ resume.created_at | date:'mediumDate' }}
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <div class="resume-stats">
              <div class="stat">
                <span class="stat-value">{{ resume.skills.length || 0 }}</span>
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
            <button mat-button color="warn" (click)="deleteResume(resume)">
              <mat-icon>delete</mat-icon>
              Delete
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h1 {
        margin: 0;
      }

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: white;
      border-radius: 8px;

      mat-icon {
        font-size: 80px;
        width: 80px;
        height: 80px;
        color: #ccc;
      }

      h2 {
        margin: 16px 0 8px;
        color: #333;
      }

      p {
        color: #666;
        margin-bottom: 24px;
      }
    }

    .resume-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }

    .resume-card {
      transition: box-shadow 0.2s;

      &.active {
        border: 2px solid #4caf50;
      }

      mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
      }

      .active-badge {
        background-color: #4caf50;
        color: white;
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 12px;
        margin-left: 8px;
      }
    }

    .resume-stats {
      display: flex;
      gap: 24px;
      margin: 16px 0;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;

      .stat {
        text-align: center;

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 600;
          color: #1976d2;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
        }
      }
    }

    .skills-section {
      margin-top: 16px;

      h4 {
        margin-bottom: 8px;
        font-size: 14px;
        color: #666;
      }

      mat-chip {
        font-size: 12px;
      }
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `]
})
export class ResumeListComponent implements OnInit {
  private resumeService = inject(ResumeService);
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
        this.snackBar.open('Resume uploaded successfully!', 'Close', { duration: 3000 });
        this.loadResumes();
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  setActive(resume: Resume): void {
    this.resumeService.setActiveResume(resume.id).subscribe({
      next: () => {
        this.snackBar.open('Resume set as active', 'Close', { duration: 3000 });
        this.loadResumes();
      }
    });
  }

  deleteResume(resume: Resume): void {
    if (confirm('Are you sure you want to delete this resume?')) {
      this.resumeService.deleteResume(resume.id).subscribe({
        next: () => {
          this.snackBar.open('Resume deleted', 'Close', { duration: 3000 });
          this.loadResumes();
        }
      });
    }
  }
}
