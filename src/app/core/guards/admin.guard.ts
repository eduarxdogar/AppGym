import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

const SUPER_ADMIN_EMAIL = 'cristiangarzon1231@gmail.com';

/**
 * Guard funcional que protege rutas exclusivas del Super Admin.
 * Valida el email del usuario autenticado contra el email del admin.
 * Si no coincide → redirige a /dashboard.
 */
export const adminGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.authState$.pipe(
    take(1),
    map(user => {
      if (user?.email === SUPER_ADMIN_EMAIL) {
        return true;
      }
      return router.createUrlTree(['/dashboard']);
    })
  );
};
