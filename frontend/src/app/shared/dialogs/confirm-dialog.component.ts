import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  confirmColor?: 'primary' | 'warn' | 'accent';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-icon" *ngIf="data.icon">
        <mat-icon [style.color]="iconColor">{{ data.icon }}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close>{{ data.cancelText || 'Cancel' }}</button>
        <button mat-raised-button [color]="data.confirmColor || 'warn'" [mat-dialog-close]="true">
          <mat-icon *ngIf="data.confirmColor === 'warn'">delete</mat-icon>
          {{ data.confirmText || 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      text-align: center;
      padding: 8px 0;
    }
    .dialog-icon {
      margin: 8px 0 4px;
    }
    .dialog-icon mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      line-height: 48px;
    }
    h2 {
      margin: 8px 0 4px;
      font-weight: 600;
      font-size: 20px;
    }
    mat-dialog-content p {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
      margin: 8px 0;
    }
    mat-dialog-actions {
      padding: 16px 24px 8px;
      gap: 12px;
    }
    mat-dialog-actions button {
      min-width: 100px;
    }
  `]
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  get iconColor(): string {
    switch (this.data.confirmColor) {
      case 'warn': return '#e53935';
      case 'primary': return '#1976d2';
      case 'accent': return '#7b1fa2';
      default: return '#e53935';
    }
  }
}
