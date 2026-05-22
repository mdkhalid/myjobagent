import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface User {
  id: string;
  email: string;
  full_name: string;
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

  login(email: string, password: string): Observable<Token> {
    return this.http.post<Token>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap(response => {
          this.setToken(response.access_token);
          this.loadStoredUser();
          this.snackBar.open('Login successful!', 'Close', { duration: 3000 });
        })
      );
  }

  register(email: string, password: string, fullName: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, {
      email,
      password,
      full_name: fullName
    });
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
}
