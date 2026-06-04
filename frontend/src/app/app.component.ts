import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule
  ],
  template: `
    <div class="app-container">
      <mat-toolbar *ngIf="authService.isAuthenticated()" class="app-toolbar">
        <span class="logo">
          <mat-icon>work</mat-icon>
          Job Agent
        </span>
        <span class="spacer"></span>
        <nav>
          <a mat-button routerLink="/dashboard" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            Dashboard
          </a>
          <a mat-button *ngIf="!authService.isCompany()" routerLink="/resumes" routerLinkActive="active">
            <mat-icon>description</mat-icon>
            Resumes
          </a>
          <a mat-button *ngIf="!authService.isCompany()" routerLink="/jobs" routerLinkActive="active">
            <mat-icon>search</mat-icon>
            Jobs
          </a>
          <a mat-button *ngIf="!authService.isCompany()" routerLink="/applications" routerLinkActive="active">
            <mat-icon>assignment</mat-icon>
            Applications
          </a>
          <a mat-button *ngIf="!authService.isCompany()" routerLink="/automation" routerLinkActive="active">
            <mat-icon>auto_mode</mat-icon>
            Auto-Apply
          </a>
          <!-- Multi-source search — hidden in favor of /jobs page
          <a mat-button routerLink="/search" routerLinkActive="active">
            <mat-icon>search</mat-icon>
            Job Search
          </a>
          -->
          <a mat-button routerLink="/analytics" routerLinkActive="active">
            <mat-icon>insights</mat-icon>
            Analytics
          </a>
          <a mat-button *ngIf="authService.isAdmin()" routerLink="/admin/users" routerLinkActive="active">
            <mat-icon>manage_accounts</mat-icon>
            Users
          </a>
        </nav>
        <span class="spacer"></span>
        <div class="user-info">
          <span class="role-badge" [ngClass]="authService.getUserRole() || ''">
            <mat-icon>{{ roleIcon() }}</mat-icon>
            {{ roleLabel() }}
          </span>
        </div>
        <button mat-icon-button [matMenuTriggerFor]="userMenu">
          <mat-icon>account_circle</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu">
          <button mat-menu-item disabled>
            <mat-icon>person</mat-icon>
            <span>{{ (authService.currentUser$ | async)?.full_name || 'User' }}</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()">
            <mat-icon>exit_to_app</mat-icon>
            <span>Logout</span>
          </button>
        </mat-menu>
      </mat-toolbar>
      
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .app-toolbar {
      background: rgba(15, 23, 42, 0.85) !important;
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--text);
    }
    
    .spacer {
      flex: 1;
    }
    
    nav {
      display: flex;
      gap: 4px;
      
      a {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text-secondary) !important;
        transition: color var(--transition);
        
        &:hover {
          color: var(--text) !important;
        }
        
        &.active {
          color: var(--primary-light) !important;
        }
      }
    }
    
    .main-content {
      flex: 1;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      margin-right: 8px;
    }
    
    .role-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 12px 3px 8px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      &.jobseeker {
        background: rgba(99, 102, 241, 0.12);
        color: var(--primary-light);
      }

      &.company {
        background: rgba(34, 197, 94, 0.12);
        color: var(--success);
      }

      &.admin {
        background: rgba(245, 158, 11, 0.12);
        color: var(--warning);
      }
    }
    
    @media (max-width: 768px) {
      nav {
        display: none;
      }
      .user-info {
        display: none;
      }
    }
  `]
})
export class AppComponent {
  constructor(public authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }

  roleIcon(): string {
    const role = this.authService.getUserRole();
    switch (role) {
      case 'jobseeker': return 'person_search';
      case 'company': return 'business_center';
      case 'admin': return 'admin_panel_settings';
      default: return 'person';
    }
  }

  roleLabel(): string {
    const role = this.authService.getUserRole();
    switch (role) {
      case 'jobseeker': return 'Job Seeker';
      case 'company': return 'Company';
      case 'admin': return 'Admin';
      default: return '';
    }
  }
}
