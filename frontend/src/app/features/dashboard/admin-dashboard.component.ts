import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminDashboard } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule, MatProgressSpinnerModule],
  template: `
    <div class="dashboard-grid fade-in">
      <!-- Welcome -->
      <div class="welcome-card">
        <div>
          <h2><mat-icon>admin_panel_settings</mat-icon> Admin Dashboard</h2>
          <p>Platform overview and system management</p>
        </div>
        <div class="welcome-actions">
          <button mat-stroked-button (click)="manageUsers.emit()">
            <mat-icon>manage_accounts</mat-icon> Manage Users
          </button>
        </div>
      </div>

      <!-- Platform Stats -->
      <div class="stats-row">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon blue"><mat-icon>people</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().total_users }}</div>
              <div class="stat-label">Total Users</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon green"><mat-icon>work</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().total_jobs }}</div>
              <div class="stat-label">Total Jobs</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon purple"><mat-icon>assignment</mat-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ stats().total_applications }}</div>
              <div class="stat-label">Total Applications</div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Users by Role -->
      <mat-card class="users-card">
        <mat-card-header>
          <mat-card-title><mat-icon>group</mat-icon> Users by Role</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="role-grid">
            <div class="role-item">
              <div class="role-icon seeker"><mat-icon>person_search</mat-icon></div>
              <div class="role-count">{{ roleCount('jobseeker') }}</div>
              <div class="role-label">Job Seekers</div>
            </div>
            <div class="role-item">
              <div class="role-icon company"><mat-icon>business_center</mat-icon></div>
              <div class="role-count">{{ roleCount('company') }}</div>
              <div class="role-label">Companies</div>
            </div>
            <div class="role-item">
              <div class="role-icon admin"><mat-icon>admin_panel_settings</mat-icon></div>
              <div class="role-count">{{ roleCount('admin') }}</div>
              <div class="role-label">Admins</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Quick Actions -->
      <mat-card class="actions-card">
        <mat-card-header>
          <mat-card-title><mat-icon>flash_on</mat-icon> Quick Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="action-buttons">
            <button mat-raised-button color="primary" (click)="manageUsers.emit()">
              <mat-icon>manage_accounts</mat-icon> User Management
            </button>
            <button mat-raised-button color="accent" routerLink="/analytics">
              <mat-icon>insights</mat-icon> Platform Analytics
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-grid { display: flex; flex-direction: column; gap: 24px; }

    .welcome-card {
      display: flex; justify-content: space-between; align-items: center;
      padding: 24px; background: linear-gradient(135deg, rgba(245,158,11,0.06), rgba(99,102,241,0.06));
      border: 1px solid var(--border); border-radius: var(--radius-lg); flex-wrap: wrap; gap: 16px;
    }
    .welcome-text h2 { margin: 0; }
    .welcome-card h2 { margin: 0; font-size: 20px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 10px; }
    .welcome-card p { margin: 4px 0 0; color: var(--text-secondary); font-size: 14px; }
    .welcome-actions { display: flex; gap: 12px; }

    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .stat-card mat-card-content { display: flex; align-items: center; gap: 14px; padding: 18px; }
    .stat-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .stat-icon.blue { background: rgba(99,102,241,0.12); color: var(--primary-light); }
    .stat-icon.green { background: rgba(34,197,94,0.12); color: var(--success); }
    .stat-icon.purple { background: rgba(168,85,247,0.12); color: #c084fc; }
    .stat-info { flex: 1; }
    .stat-value { font-size: 28px; font-weight: 700; line-height: 1; color: var(--text); }
    .stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

    .users-card mat-card-title { display: flex; align-items: center; gap: 8px; }
    .role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 8px 0; }
    .role-item { text-align: center; padding: 24px; border-radius: var(--radius-md); background: rgba(148,163,184,0.04); border: 1px solid var(--border); }
    .role-icon { margin-bottom: 8px; }
    .role-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .role-icon.seeker mat-icon { color: var(--primary-light); }
    .role-icon.company mat-icon { color: var(--success); }
    .role-icon.admin mat-icon { color: var(--warning); }
    .role-count { font-size: 32px; font-weight: 700; color: var(--text); }
    .role-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

    .actions-card mat-card-title { display: flex; align-items: center; gap: 8px; }
    .action-buttons { display: flex; flex-wrap: wrap; gap: 12px; }
    .action-buttons button { flex: 1; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 8px; }

    @media (max-width: 768px) { .role-grid { grid-template-columns: 1fr; } }
  `],
})
export class AdminDashboardComponent {
  readonly data = input<AdminDashboard | null>(null);
  readonly manageUsers = output<void>();

  stats() {
    return this.data()?.stats || { total_users: 0, total_jobs: 0, total_applications: 0, users_by_role: {} };
  }

  roleCount(role: string): number {
    return this.data()?.stats?.users_by_role?.[role] || 0;
  }
}
