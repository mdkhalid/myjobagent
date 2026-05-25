import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
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
    MatMenuModule
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
          <a mat-button routerLink="/resumes" routerLinkActive="active">
            <mat-icon>description</mat-icon>
            Resumes
          </a>
          <a mat-button routerLink="/jobs" routerLinkActive="active">
            <mat-icon>search</mat-icon>
            Jobs
          </a>
          <a mat-button routerLink="/applications" routerLinkActive="active">
            <mat-icon>assignment</mat-icon>
            Applications
          </a>
          <a mat-button routerLink="/automation" routerLinkActive="active">
            <mat-icon>auto_mode</mat-icon>
            Auto-Apply
          </a>
          <a mat-button routerLink="/search" routerLinkActive="active">
            <mat-icon>search</mat-icon>
            Job Search
          </a>
          <a mat-button routerLink="/analytics" routerLinkActive="active">
            <mat-icon>insights</mat-icon>
            Analytics
          </a>
        </nav>
        <span class="spacer"></span>
        <button mat-icon-button [matMenuTriggerFor]="userMenu">
          <mat-icon>account_circle</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu">
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
    
    @media (max-width: 768px) {
      nav {
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
}
