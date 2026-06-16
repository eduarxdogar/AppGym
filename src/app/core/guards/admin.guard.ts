import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { tap } from 'rxjs/operators';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.isAdmin$.pipe(
    tap((isAdmin) => {
      if (!isAdmin) {
        router.navigate(['/dashboard']);
      }
    })
  );
};
