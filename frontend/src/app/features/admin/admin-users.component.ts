import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { DashboardService, AdminUser } from '../../core/services/dashboard.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatSelectModule, MatTableModule, MatSortModule, MatPaginatorModule,
    MatChipsModule, MatProgressSpinnerModule,
    MatTooltipModule, MatMenuModule,
  ],
  template: `
    <div class="container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title"><mat-icon>manage_accounts</mat-icon> User Management</h1>
          <p class="page-subtitle">View, search, and manage all platform users</p>
        </div>
        <div class="header-stats">
          <span class="header-stat"><strong>{{ totalUsers }}</strong> users</span>
        </div>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search users</mat-label>
              <input matInput [formControl]="searchControl" placeholder="Name, email, or company...">
              <mat-icon matPrefix>search</mat-icon>
              <button *ngIf="searchControl.value" matSuffix mat-icon-button (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            </mat-form-field>
            <mat-form-field appearance="outline" class="role-filter">
              <mat-label>Role</mat-label>
              <mat-select [formControl]="roleControl" (selectionChange)="onRoleChange($event.value)">
                <mat-option value="">All Roles</mat-option>
                <mat-option value="jobseeker">Job Seeker</mat-option>
                <mat-option value="company">Company</mat-option>
                <mat-option value="admin">Admin</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button (click)="loadUsers()" class="refresh-btn">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Loading -->
      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <!-- Error -->
      <div *ngIf="error" class="error-state">
        <mat-icon>error</mat-icon>
        <p>{{ error }}</p>
        <button mat-stroked-button (click)="loadUsers()">Retry</button>
      </div>

      <!-- User Table -->
      <mat-card class="table-card" *ngIf="!isLoading && !error">
        <mat-card-content class="table-wrapper">
          <table mat-table [dataSource]="users()" matSort class="users-table">

            <!-- Name Column -->
            <ng-container matColumnDef="full_name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let user">
                <div class="name-cell">
                  <div class="avatar" [ngClass]="user.role">
                    {{ user.full_name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="name-info">
                    <span class="name-text">{{ user.full_name }}</span>
                    <span class="name-email">{{ user.email }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Role Column -->
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Role</th>
              <td mat-cell *matCellDef="let user">
                <span class="role-badge-sm" [ngClass]="user.role">
                  <mat-icon>{{ roleIcon(user.role) }}</mat-icon>
                  {{ roleLabel(user.role) }}
                </span>
              </td>
            </ng-container>

            <!-- Company Column -->
            <ng-container matColumnDef="company_name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Company</th>
              <td mat-cell *matCellDef="let user">
                <span class="company-text">{{ user.company_name || '—' }}</span>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="is_active">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
              <td mat-cell *matCellDef="let user">
                <span class="status-pill" [class.active]="user.is_active" [class.inactive]="!user.is_active">
                  <span class="status-dot"></span>
                  {{ user.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </ng-container>

            <!-- Joined Column -->
            <ng-container matColumnDef="created_at">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Joined</th>
              <td mat-cell *matCellDef="let user">
                <span class="date-text">{{ user.created_at | date:'MMM d, yyyy' }}</span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let user">
                <div class="actions-cell">
                  <button mat-icon-button [matMenuTriggerFor]="userMenu" (click)="$event.stopPropagation()">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #userMenu="matMenu" xPosition="before">
                    <button mat-menu-item (click)="toggleUserActive(user)">
                      <mat-icon [style.color]="user.is_active ? 'var(--warn)' : 'var(--success)'">
                        {{ user.is_active ? 'block' : 'check_circle' }}
                      </mat-icon>
                      <span>{{ user.is_active ? 'Deactivate' : 'Activate' }}</span>
                    </button>
                    <button mat-menu-item (click)="viewUserDetails(user)">
                      <mat-icon>visibility</mat-icon>
                      <span>View Details</span>
                    </button>
                  </mat-menu>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="user-row"
                (click)="viewUserDetails(row)"></tr>

            <!-- Empty state -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell no-data" [attr.colspan]="displayedColumns.length">
                <div class="empty-table">
                  <mat-icon>search_off</mat-icon>
                  <p>No users found matching your filters</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>

        <mat-paginator
          [length]="totalUsers"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50]"
          (page)="onPageChange($event)"
          showFirstLastButtons
        >
        </mat-paginator>
      </mat-card>

      <!-- User Detail Dialog (shown inline via a card) -->
      <mat-card class="detail-card fade-in" *ngIf="selectedUser">
        <mat-card-header>
          <mat-card-title>
            <div class="avatar large" [ngClass]="selectedUser.role">
              {{ selectedUser.full_name.charAt(0).toUpperCase() }}
            </div>
            <div class="detail-title-text">
              <span>{{ selectedUser.full_name }}</span>
              <span class="detail-subtitle">{{ selectedUser.email }}</span>
            </div>
          </mat-card-title>
          <button mat-icon-button (click)="selectedUser = null">
            <mat-icon>close</mat-icon>
          </button>
        </mat-card-header>
        <mat-card-content>
          <div class="detail-grid">
            <div class="detail-field">
              <span class="field-label">Role</span>
              <span class="role-badge-sm" [ngClass]="selectedUser.role">
                <mat-icon>{{ roleIcon(selectedUser.role) }}</mat-icon>
                {{ roleLabel(selectedUser.role) }}
              </span>
            </div>
            <div class="detail-field">
              <span class="field-label">Status</span>
              <span class="status-pill" [class.active]="selectedUser.is_active" [class.inactive]="!selectedUser.is_active">
                <span class="status-dot"></span>
                {{ selectedUser.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <div class="detail-field" *ngIf="selectedUser.company_name">
              <span class="field-label">Company</span>
              <span>{{ selectedUser.company_name }}</span>
            </div>
            <div class="detail-field">
              <span class="field-label">User ID</span>
              <code>{{ selectedUser.id }}</code>
            </div>
            <div class="detail-field">
              <span class="field-label">Joined</span>
              <span>{{ selectedUser.created_at | date:'MMMM d, yyyy h:mm a' }}</span>
            </div>
            <div class="detail-field">
              <span class="field-label">Last Updated</span>
              <span>{{ selectedUser.updated_at | date:'MMMM d, yyyy h:mm a' }}</span>
            </div>
          </div>
          <div class="detail-actions">
            <button mat-raised-button [color]="selectedUser.is_active ? 'warn' : 'primary'"
                    (click)="toggleUserActive(selectedUser)">
              <mat-icon>{{ selectedUser.is_active ? 'block' : 'check_circle' }}</mat-icon>
              {{ selectedUser.is_active ? 'Deactivate User' : 'Activate User' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
    }
    .page-title { display: flex; align-items: center; gap: 12px; margin: 0; }
    .page-title mat-icon { color: var(--warning); }
    .page-subtitle { margin: 4px 0 0 44px; color: var(--text-secondary); font-size: 14px; }
    .header-stats { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border); }
    .header-stat { font-size: 14px; color: var(--text-secondary); }
    .header-stat strong { color: var(--text); font-size: 16px; }
    .divider { width: 1px; height: 24px; background: var(--border); }

    .filters-card { margin-bottom: 20px; }
    .filters-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .search-field { flex: 1; min-width: 240px; }
    .role-filter { min-width: 160px; }
    .refresh-btn { height: 56px; display: flex; align-items: center; gap: 6px; }

    .loading-container { display: flex; justify-content: center; padding: 80px; }
    .error-state { text-align: center; padding: 60px; }
    .error-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--warn); }
    .error-state p { margin: 12px 0; color: var(--text-secondary); }

    .table-card { overflow: hidden; }
    .table-wrapper { overflow-x: auto; padding: 0 !important; }

    ::ng-deep .users-table { width: 100%; }
    ::ng-deep .users-table .mat-mdc-header-cell {
      color: var(--text-secondary); font-weight: 600; font-size: 12px;
      text-transform: uppercase; letter-spacing: 0.04em;
      background: var(--bg-card); border-bottom-color: var(--border);
    }
    ::ng-deep .users-table .mat-mdc-cell {
      color: var(--text); border-bottom-color: var(--border);
      padding: 12px 16px;
    }

    ::ng-deep .user-row { cursor: pointer; transition: background var(--transition); }
    ::ng-deep .user-row:hover { background: rgba(99, 102, 241, 0.04); }

    .name-cell { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; flex-shrink: 0;
      &.large { width: 44px; height: 44px; font-size: 18px; }
      &.jobseeker { background: rgba(99,102,241,0.12); color: var(--primary-light); }
      &.company { background: rgba(34,197,94,0.12); color: var(--success); }
      &.admin { background: rgba(245,158,11,0.12); color: var(--warning); }
    }
    .name-info { display: flex; flex-direction: column; min-width: 0; }
    .name-text { font-weight: 500; font-size: 14px; color: var(--text); }
    .name-email { font-size: 12px; color: var(--text-muted); }

    .role-badge-sm {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 10px 2px 6px; border-radius: 12px;
      font-size: 12px; font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.jobseeker { background: rgba(99,102,241,0.1); color: var(--primary-light); }
      &.company { background: rgba(34,197,94,0.1); color: var(--success); }
      &.admin { background: rgba(245,158,11,0.1); color: var(--warning); }
    }

    .company-text { font-size: 14px; color: var(--text-secondary); }

    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;
      .status-dot { width: 6px; height: 6px; border-radius: 50%; }
      &.active { background: rgba(34,197,94,0.1); color: var(--success); .status-dot { background: var(--success); } }
      &.inactive { background: rgba(148,163,184,0.1); color: var(--text-muted); .status-dot { background: var(--text-muted); } }
    }

    .date-text { font-size: 13px; color: var(--text-secondary); }

    .actions-cell { display: flex; justify-content: flex-end; }

    .no-data { padding: 40px; text-align: center; }
    .empty-table { padding: 40px; text-align: center; }
    .empty-table mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--text-muted); }
    .empty-table p { margin: 12px 0; color: var(--text-secondary); }

    .detail-card {
      margin-top: 20px;
      border: 1px solid var(--primary) !important;
      background: rgba(99, 102, 241, 0.04) !important;
    }
    .detail-card mat-card-title {
      display: flex; align-items: center; gap: 14px;
    }
    .detail-title-text {
      display: flex; flex-direction: column;
      span:first-child { font-size: 18px; font-weight: 600; color: var(--text); }
      .detail-subtitle { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
    }
    .detail-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 16px 0;
    }
    .detail-field {
      display: flex; flex-direction: column; gap: 4px;
      .field-label { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
      span:not(.field-label):not(.role-badge-sm):not(.status-pill) { font-size: 14px; color: var(--text); }
      code { font-size: 12px; color: var(--text-secondary); word-break: break-all; }
    }
    .detail-actions { display: flex; gap: 12px; margin-top: 8px; }

    @media (max-width: 768px) {
      .filters-row { flex-direction: column; }
      .search-field, .role-filter { min-width: 100%; }
      .detail-grid { grid-template-columns: 1fr; }
      .header-stats { width: 100%; }
    }
  `],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  users = signal<AdminUser[]>([]);
  selectedUser: AdminUser | null = null;
  isLoading = true;
  error: string | null = null;
  totalUsers = 0;

  pageSize = 25;
  currentPage = 0;

  searchControl = this.fb.control('');
  roleControl = this.fb.control('');

  displayedColumns = ['full_name', 'role', 'company_name', 'is_active', 'created_at', 'actions'];

  private searchSubject = new Subject<string>();
  private searchSub: any;

  ngOnInit(): void {
    this.loadUsers();

    // Debounced search
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => this.loadUsers());

    this.searchControl.valueChanges.subscribe(v => this.searchSubject.next(v || ''));
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = null;
    this.selectedUser = null;

    const params: any = {
      skip: this.currentPage * this.pageSize,
      limit: this.pageSize,
    };
    if (this.roleControl.value) params.role = this.roleControl.value;
    if (this.searchControl.value) params.search = this.searchControl.value;

    this.dashboardService.getAdminUsers(params).subscribe({
      next: (users) => {
        this.users.set(users);
        this.totalUsers = users.length; // Backend returns limited set; real total could come from header
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.detail || 'Failed to load users';
      },
    });
  }

  onRoleChange(role: string): void {
    this.currentPage = 0;
    this.loadUsers();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.loadUsers();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.loadUsers();
  }

  toggleUserActive(user: AdminUser): void {
    const action = user.is_active ? 'deactivate' : 'activate';
    this.dashboardService.toggleUserActive(user.id).subscribe({
      next: (res) => {
        this.snackBar.open(res.message || `User ${action}d`, 'Close', { duration: 3000 });
        this.loadUsers();
      },
      error: (err) => {
        this.snackBar.open(err.error?.detail || `Failed to ${action} user`, 'Close', { duration: 5000 });
      },
    });
  }

  viewUserDetails(user: AdminUser): void {
    this.selectedUser = this.selectedUser?.id === user.id ? null : user;
  }

  roleIcon(role: string): string {
    switch (role) {
      case 'jobseeker': return 'person_search';
      case 'company': return 'business_center';
      case 'admin': return 'admin_panel_settings';
      default: return 'person';
    }
  }

  roleLabel(role: string): string {
    switch (role) {
      case 'jobseeker': return 'Job Seeker';
      case 'company': return 'Company';
      case 'admin': return 'Admin';
      default: return role;
    }
  }
}
