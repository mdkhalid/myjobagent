import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService, UserRole, RegisterData } from '../../../core/services/auth.service';

type RoleOption = {
  value: UserRole;
  icon: string;
  title: string;
  description: string;
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatChipsModule,
  ],
  template: `
    <div class="register-page">
      <div class="register-container">
        <!-- Header -->
        <div class="brand-header">
          <mat-icon class="brand-icon">work</mat-icon>
          <h1>Job Agent</h1>
          <p class="brand-subtitle">AI-powered job search & talent platform</p>
        </div>

        <mat-card class="register-card">
          <mat-card-header>
            <mat-card-title>Create your account</mat-card-title>
            <mat-card-subtitle>
              Choose your account type below
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <!-- Role Selection Cards -->
            <div class="role-selector">
              <button
                *ngFor="let role of roles"
                class="role-card"
                [class.selected]="selectedRole() === role.value"
                (click)="selectRole(role.value)"
                type="button"
              >
                <div class="role-icon-wrapper" [ngClass]="role.value">
                  <mat-icon>{{ role.icon }}</mat-icon>
                </div>
                <div class="role-text">
                  <strong>{{ role.title }}</strong>
                  <span>{{ role.description }}</span>
                </div>
                <mat-icon class="check-icon" *ngIf="selectedRole() === role.value">check_circle</mat-icon>
              </button>
            </div>

            <!-- Registration Form -->
            <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="register-form">
              <!-- Common Fields -->
              <div class="form-section">
                <h3 class="section-title">
                  <mat-icon>person</mat-icon>
                  Basic Information
                </h3>
                <div class="form-row">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Full Name</mat-label>
                    <input matInput formControlName="fullName" placeholder="John Doe">
                    <mat-icon matPrefix>person</mat-icon>
                    <mat-error *ngIf="registerForm.get('fullName')?.hasError('required')">
                      Full name is required
                    </mat-error>
                  </mat-form-field>
                </div>
                <div class="form-row">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Email</mat-label>
                    <input matInput type="email" formControlName="email" placeholder="you@example.com">
                    <mat-icon matPrefix>email</mat-icon>
                    <mat-error *ngIf="registerForm.get('email')?.hasError('required')">
                      Email is required
                    </mat-error>
                    <mat-error *ngIf="registerForm.get('email')?.hasError('email')">
                      Please enter a valid email
                    </mat-error>
                  </mat-form-field>
                </div>
                <div class="form-row double">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Password</mat-label>
                    <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password">
                    <mat-icon matPrefix>lock</mat-icon>
                    <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword">
                      <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    <mat-error *ngIf="registerForm.get('password')?.hasError('required')">
                      Password is required
                    </mat-error>
                    <mat-error *ngIf="registerForm.get('password')?.hasError('minlength')">
                      At least 6 characters
                    </mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Confirm Password</mat-label>
                    <input matInput [type]="hideConfirmPassword ? 'password' : 'text'" formControlName="confirmPassword">
                    <mat-icon matPrefix>lock</mat-icon>
                    <button mat-icon-button matSuffix type="button" (click)="hideConfirmPassword = !hideConfirmPassword">
                      <mat-icon>{{ hideConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    <mat-error *ngIf="registerForm.get('confirmPassword')?.hasError('required')">
                      Please confirm your password
                    </mat-error>
                  </mat-form-field>
                </div>
                <mat-error *ngIf="registerForm.hasError('mismatch') && registerForm.get('confirmPassword')?.touched" class="form-error">
                  <mat-icon>error</mat-icon> Passwords do not match
                </mat-error>
              </div>

              <!-- Company Fields (shown when role is 'company') -->
              <div *ngIf="selectedRole() === 'company'" class="form-section fade-in-section">
                <h3 class="section-title">
                  <mat-icon>business</mat-icon>
                  Company Details
                </h3>
                <div class="form-row">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Company Name</mat-label>
                    <input matInput formControlName="companyName" placeholder="Acme Inc.">
                    <mat-icon matPrefix>business</mat-icon>
                    <mat-error *ngIf="registerForm.get('companyName')?.hasError('required')">
                      Company name is required
                    </mat-error>
                  </mat-form-field>
                </div>
                <div class="form-row double">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Industry</mat-label>
                    <mat-select formControlName="industry">
                      <mat-option value="">Select industry</mat-option>
                      <mat-option value="Technology">Technology</mat-option>
                      <mat-option value="Finance">Finance</mat-option>
                      <mat-option value="Healthcare">Healthcare</mat-option>
                      <mat-option value="Education">Education</mat-option>
                      <mat-option value="E-commerce">E-commerce</mat-option>
                      <mat-option value="Consulting">Consulting</mat-option>
                      <mat-option value="Media">Media & Entertainment</mat-option>
                      <mat-option value="Real Estate">Real Estate</mat-option>
                      <mat-option value="Manufacturing">Manufacturing</mat-option>
                      <mat-option value="Other">Other</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Company Size</mat-label>
                    <mat-select formControlName="companySize">
                      <mat-option value="">Select size</mat-option>
                      <mat-option value="1-10">1-10 employees</mat-option>
                      <mat-option value="11-50">11-50 employees</mat-option>
                      <mat-option value="51-200">51-200 employees</mat-option>
                      <mat-option value="201-1000">201-1000 employees</mat-option>
                      <mat-option value="1000+">1000+ employees</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
                <div class="form-row">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Company Website</mat-label>
                    <input matInput formControlName="companyWebsite" placeholder="https://acme.com">
                    <mat-icon matPrefix>language</mat-icon>
                  </mat-form-field>
                </div>
                <div class="form-row">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Company Description</mat-label>
                    <textarea matInput formControlName="companyDescription" rows="3"
                              placeholder="Tell us about your company and what you're looking for..."></textarea>
                  </mat-form-field>
                </div>
              </div>

              <!-- Jobseeker Fields (shown when role is 'jobseeker') -->
              <div *ngIf="selectedRole() === 'jobseeker'" class="form-section fade-in-section">
                <h3 class="section-title">
                  <mat-icon>badge</mat-icon>
                  Professional Details
                </h3>
                <div class="form-row double">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Phone (optional)</mat-label>
                    <input matInput formControlName="phone" placeholder="+1 (555) 123-4567" type="tel">
                    <mat-icon matPrefix>phone</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Location (optional)</mat-label>
                    <input matInput formControlName="location" placeholder="San Francisco, CA">
                    <mat-icon matPrefix>location_on</mat-icon>
                  </mat-form-field>
                </div>
                <div class="form-row">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Professional Headline (optional)</mat-label>
                    <input matInput formControlName="headline" placeholder="e.g. Senior Software Engineer">
                    <mat-icon matPrefix>work</mat-icon>
                    <mat-hint>Brief title that describes who you are professionally</mat-hint>
                  </mat-form-field>
                </div>
                <div class="form-row double">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>LinkedIn URL (optional)</mat-label>
                    <input matInput formControlName="linkedinUrl" placeholder="https://linkedin.com/in/...">
                    <mat-icon matPrefix>link</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Portfolio / Website (optional)</mat-label>
                    <input matInput formControlName="portfolioUrl" placeholder="https://your-website.com">
                    <mat-icon matPrefix>language</mat-icon>
                  </mat-form-field>
                </div>
              </div>

              <!-- Admin has no extra fields -->

              <button
                mat-raised-button
                color="primary"
                type="submit"
                class="submit-btn"
                [disabled]="registerForm.invalid || isLoading || !selectedRole()"
              >
                <mat-icon *ngIf="!isLoading">person_add</mat-icon>
                <mat-spinner *ngIf="isLoading" diameter="20"></mat-spinner>
                {{ isLoading ? 'Creating account...' : getSubmitText() }}
              </button>
            </form>
          </mat-card-content>

          <mat-card-actions>
            <p class="login-link">
              Already have an account?
              <a mat-button color="accent" routerLink="/login">Sign In</a>
            </p>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .register-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      background: var(--bg);
      background-image:
        radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.10) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
    }

    .register-container {
      width: 100%;
      max-width: 640px;
    }

    .brand-header {
      text-align: center;
      margin-bottom: 28px;

      .brand-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--primary-light);
        margin-bottom: 8px;
      }

      h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0;
        background: linear-gradient(135deg, var(--text), var(--primary-light));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .brand-subtitle {
        color: var(--text-secondary);
        font-size: 15px;
        margin-top: 4px;
      }
    }

    .register-card {
      border: 1px solid var(--border) !important;
      overflow: visible;

      mat-card-header {
        text-align: center;
        padding: 28px 24px 0 !important;
        display: block;

        mat-card-title {
          font-size: 24px !important;
          font-weight: 700 !important;
        }

        mat-card-subtitle {
          font-size: 14px;
          margin-top: 4px;
        }
      }

      mat-card-content {
        padding: 24px !important;
      }

      mat-card-actions {
        justify-content: center;
        padding: 4px 24px 20px !important;
      }
    }

    .login-link {
      color: var(--text-secondary);
      font-size: 14px;
    }

    /* ── Role Selector ─────────────────────────────────────────────── */

    .role-selector {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
    }

    .role-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 20px 12px 16px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 2px solid var(--border);
      cursor: pointer;
      transition: all var(--transition);
      position: relative;
      text-align: center;
      font-family: inherit;
      color: inherit;
      width: 100%;

      &:hover {
        border-color: var(--border-light);
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      &.selected {
        border-color: var(--primary);
        background: rgba(99, 102, 241, 0.08);
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2), var(--shadow-md);
      }

      .role-icon-wrapper {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        &.jobseeker {
          background: rgba(99, 102, 241, 0.12);
          mat-icon { color: var(--primary-light); }
        }
        &.company {
          background: rgba(34, 197, 94, 0.12);
          mat-icon { color: var(--success); }
        }
        &.admin {
          background: rgba(245, 158, 11, 0.12);
          mat-icon { color: var(--warning); }
        }
      }

      .role-text {
        display: flex;
        flex-direction: column;
        gap: 2px;

        strong {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
        }

        span {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.3;
        }
      }

      .check-icon {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--primary);
      }
    }

    /* ── Form Sections ────────────────────────────────────────────── */

    .form-section {
      margin-bottom: 24px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 16px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--primary-light);
      }
    }

    .register-form {
      display: flex;
      flex-direction: column;
    }

    .form-row {
      display: flex;
      gap: 14px;
      margin-bottom: 4px;

      &.double > * { flex: 1; }
    }

    .flex-1 { flex: 1; }

    .form-error {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--warn);
      margin: 4px 0 12px;

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .submit-btn {
      width: 100%;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 16px;
      margin-top: 8px;
    }

    /* ── Animations ───────────────────────────────────────────────── */

    .fade-in-section {
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Responsive ───────────────────────────────────────────────── */

    @media (max-width: 600px) {
      .register-page { padding: 16px 12px; }

      .role-selector {
        flex-direction: column;
        gap: 8px;
      }

      .role-card {
        flex-direction: row;
        padding: 14px 16px;
        text-align: left;

        .role-text span { display: none; }
      }

      .form-row.double {
        flex-direction: column;
        gap: 0;
      }
    }
  `],
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly selectedRole = signal<UserRole | null>(null);

  readonly roles: RoleOption[] = [
    {
      value: 'jobseeker',
      icon: 'person_search',
      title: 'Job Seeker',
      description: 'Find your dream job with AI-powered matching',
    },
    {
      value: 'company',
      icon: 'business_center',
      title: 'Company',
      description: 'Hire top talent and manage your openings',
    },
    {
      value: 'admin',
      icon: 'admin_panel_settings',
      title: 'Admin',
      description: 'Manage the platform and oversee operations',
    },
  ];

  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;

  registerForm: FormGroup = this.fb.group(
    {
      // Common fields
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],

      // Company fields
      companyName: [''],
      companyWebsite: [''],
      companySize: [''],
      industry: [''],
      companyDescription: [''],

      // Jobseeker fields
      phone: [''],
      location: [''],
      headline: [''],
      linkedinUrl: [''],
      portfolioUrl: [''],
    },
    { validators: this.passwordMatchValidator }
  );

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  selectRole(role: UserRole): void {
    this.selectedRole.set(role);

    // Update validation based on role
    const companyNameCtrl = this.registerForm.get('companyName');
    if (role === 'company') {
      companyNameCtrl?.setValidators([Validators.required]);
    } else {
      companyNameCtrl?.clearValidators();
    }
    companyNameCtrl?.updateValueAndValidity();
  }

  getSubmitText(): string {
    switch (this.selectedRole()) {
      case 'jobseeker':
        return 'Create Job Seeker Account';
      case 'company':
        return 'Create Company Account';
      case 'admin':
        return 'Create Admin Account';
      default:
        return 'Create Account';
    }
  }

  onSubmit(): void {
    if (this.registerForm.invalid || !this.selectedRole()) return;

    this.isLoading = true;
    const v = this.registerForm.value;
    const role = this.selectedRole()!;

    const data: RegisterData = {
      email: v.email,
      password: v.password,
      full_name: v.fullName,
      role,
    };

    if (role === 'company') {
      data.company_name = v.companyName;
      data.company_website = v.companyWebsite || undefined;
      data.company_size = v.companySize || undefined;
      data.industry = v.industry || undefined;
      data.company_description = v.companyDescription || undefined;
    } else if (role === 'jobseeker') {
      data.phone = v.phone || undefined;
      data.location = v.location || undefined;
      data.headline = v.headline || undefined;
      data.linkedin_url = v.linkedinUrl || undefined;
      data.portfolio_url = v.portfolioUrl || undefined;
    }

    this.authService.register(data).subscribe({
      next: () => {
        this.snackBar.open(
          `${
            role === 'company' ? 'Company' : role === 'jobseeker' ? 'Job Seeker' : 'Admin'
          } account created successfully! Please sign in.`,
          'Close',
          { duration: 5000 }
        );
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.error?.detail || err.message || 'Registration failed';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
    });
  }
}
