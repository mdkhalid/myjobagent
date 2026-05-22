import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError(error => {
      let message = 'An error occurred';

      if (error.status === 401) {
        message = 'Session expired. Please login again.';
        authService.logout();
        router.navigate(['/login']);
      } else if (error.status === 403) {
        message = 'Access denied';
      } else if (error.status === 404) {
        message = 'Resource not found';
      } else if (error.status === 422) {
        message = error.error?.detail || 'Validation error';
      } else if (error.error?.detail) {
        message = error.error.detail;
      }

      snackBar.open(message, 'Close', {
        duration: 5000,
        panelClass: 'error-snackbar'
      });

      return throwError(() => error);
    })
  );
};
