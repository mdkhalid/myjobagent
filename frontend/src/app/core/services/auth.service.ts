import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

export type UserRole = 'admin' | 'jobseeker' | 'company';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Company fields
  company_name?: string;
  company_website?: string;
  company_size?: string;
  industry?: string;
  company_description?: string;
  company_logo_url?: string;

  // Jobseeker fields
  phone?: string;
  location?: string;
  headline?: string;
  linkedin_url?: string;
  portfolio_url?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;

  // Company fields
  company_name?: string;
  company_website?: string;
  company_size?: string;
  industry?: string;
  company_description?: string;

  // Jobseeker fields
  phone?: string;
  location?: string;
  headline?: string;
  linkedin_url?: string;
  portfolio_url?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  private apiUrl = '/api/v1/auth';
  private tokenKey = 'access_token';
  private currentUserSubject = new BehaviorSubject<User | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
    const token = this.getToken();
    if (token) {
      this.getCurrentUser().subscribe({
        next: (user) => this.currentUserSubject.next(user),
        error: () => this.logout()
      });
    }
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<Token>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        switchMap(response => {
          this.setToken(response.access_token);
          return this.getCurrentUser();
        }),
        tap(user => {
          this.currentUserSubject.next(user);
          this.snackBar.open('Login successful!', 'Close', { duration: 3000 });
        })
      );
  }

  register(data: RegisterData): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, data);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
    this.snackBar.open('Logged out successfully', 'Close', { duration: 3000 });
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Get the current user's role */
  getUserRole(): UserRole | null {
    return this.currentUserSubject.value?.role || null;
  }

  /** Check if user has a specific role */
  hasRole(role: UserRole): boolean {
    return this.getUserRole() === role;
  }

  /** Check if user is a company account */
  isCompany(): boolean {
    return this.hasRole('company');
  }

  /** Check if user is a jobseeker */
  isJobseeker(): boolean {
    return this.hasRole('jobseeker');
  }

  /** Check if user is an admin */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }
}
