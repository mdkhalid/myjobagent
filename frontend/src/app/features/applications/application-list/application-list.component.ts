import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApplicationService, Application } from '../../../core/services/application.service';
import { ConfirmDialogComponent } from '../../../shared/dialogs/confirm-dialog.component';

@Component({
  selector: 'app-application-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  template: `
    <div class="container">
      <div class="header">
        <h1>My Applications</h1>
        <mat-form-field appearance="outline">
          <mat-label>Filter by Status</mat-label>
          <mat-select [(value)]="selectedStatus" (selectionChange)="filterByStatus($event.value)">
            <mat-option value="">All</mat-option>
            <mat-option value="pending">Pending</mat-option>
            <mat-option value="applied">Applied</mat-option>
            <mat-option value="screening">Screening</mat-option>
            <mat-option value="interview">Interview</mat-option>
            <mat-option value="offer">Offer</mat-option>
            <mat-option value="rejected">Rejected</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!isLoading && applications.length === 0" class="empty-state">
        <mat-icon>inbox</mat-icon>
        <h2>No applications yet</h2>
        <p>Start applying for jobs to track your progress</p>
        <button mat-raised-button color="primary" routerLink="/jobs">
          Find Jobs
        </button>
      </div>

      <div *ngIf="!isLoading && applications.length > 0" class="applications-list">
        <mat-card *ngFor="let app of applications" class="application-card">
          <mat-card-header>
            <mat-card-title>{{ app.job?.title || 'Unknown Job' }}</mat-card-title>
            <mat-card-subtitle>
              <mat-icon>business</mat-icon> {{ app.job?.company || 'Unknown Company' }}
              <span class="separator">|</span>
              <mat-icon>location_on</mat-icon> {{ app.job?.location || 'Remote' }}
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <div class="app-details">
              <div class="status-section">
                <span class="status-badge" [ngClass]="app.status">{{ app.status }}</span>
                <span *ngIf="app.auto_applied" class="auto-badge">
                  <mat-icon>auto_mode</mat-icon> Auto
                </span>
              </div>

              <div class="match-score" *ngIf="app.match_score">
                <mat-icon>psychology</mat-icon>
                {{ app.match_score | number:'1.0-0' }}% match
              </div>

              <div class="dates">
                <span *ngIf="app.applied_date">
                  <mat-icon>send</mat-icon>
                  Applied {{ app.applied_date | date:'mediumDate' }}
                </span>
                <span *ngIf="!app.applied_date">
                  <mat-icon>schedule</mat-icon>
                  Created {{ app.created_at | date:'mediumDate' }}
                </span>
              </div>

              <div class="notes" *ngIf="app.notes">
                <strong>Notes:</strong> {{ app.notes }}
              </div>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <mat-form-field appearance="outline" class="status-select">
              <mat-label>Update Status</mat-label>
              <mat-select [(value)]="app.status" (selectionChange)="updateStatus(app, $event.value)">
                <mat-option value="pending">Pending</mat-option>
                <mat-option value="applied">Applied</mat-option>
                <mat-option value="screening">Screening</mat-option>
                <mat-option value="interview">Interview</mat-option>
                <mat-option value="offer">Offer</mat-option>
                <mat-option value="rejected">Rejected</mat-option>
                <mat-option value="ghosted">Ghosted</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-button color="warn" (click)="deleteApplication(app)">
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
      flex-wrap: wrap;
      gap: 16px;

      h1 {
        margin: 0;
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
      }

      p {
        color: #666;
        margin-bottom: 24px;
      }
    }

    .applications-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .application-card {
      mat-card-subtitle {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        .separator {
          color: #ccc;
        }
      }
    }

    .app-details {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .status-section {
        display: flex;
        gap: 8px;
        align-items: center;

        .auto-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #1976d2;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }
      }

      .match-score {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #4caf50;
        font-weight: 500;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .dates {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: #666;

        span {
          display: flex;
          align-items: center;
          gap: 4px;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }
      }

      .notes {
        font-size: 14px;
        color: #666;
        padding: 12px;
        background-color: #f5f5f5;
        border-radius: 4px;
      }
    }

    mat-card-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .status-select {
        width: 150px;
      }
    }

    .status-badge {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;

      &.pending { background-color: #fff3e0; color: #e65100; }
      &.applied { background-color: #e3f2fd; color: #1565c0; }
      &.interview { background-color: #f3e5f5; color: #7b1fa2; }
      &.offer { background-color: #e8f5e9; color: #2e7d32; }
      &.rejected { background-color: #ffebee; color: #c62828; }
      &.ghosted { background-color: #f5f5f5; color: #616161; }
      &.screening { background-color: #e1f5fe; color: #0277bd; }
    }
  `]
})
export class ApplicationListComponent implements OnInit {
  private applicationService = inject(ApplicationService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  applications: Application[] = [];
  selectedStatus = '';
  isLoading = true;

  ngOnInit(): void {
    this.loadApplications();
  }

  loadApplications(): void {
    this.isLoading = true;
    const params = this.selectedStatus ? { status: this.selectedStatus } : undefined;
    
    this.applicationService.getApplications(params?.status).subscribe({
      next: (applications) => {
        this.applications = applications;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        const message = err.error?.detail || err.message || 'Failed to load applications';
        this.snackBar.open(message, 'Close', { duration: 5000 });
      }
    });
  }

  filterByStatus(status: string): void {
    this.selectedStatus = status;
    this.loadApplications();
  }

  updateStatus(application: Application, newStatus: string): void {
    this.applicationService.updateStatus(application.id, newStatus).subscribe({
      next: () => {
        this.snackBar.open('Status updated', 'Close', { duration: 3000 });
      }
    });
  }

  deleteApplication(application: Application): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Application',
        message: `Are you sure you want to delete the application for "${application.job?.title || 'Unknown'}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        icon: 'delete_forever',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.applicationService.deleteApplication(application.id).subscribe({
          next: () => {
            this.snackBar.open('Application deleted', 'Close', { duration: 3000 });
            this.loadApplications();
          },
          error: (err) => {
            const message = err.error?.detail || err.message || 'Failed to delete application';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          }
        });
      }
    });
  }
}
