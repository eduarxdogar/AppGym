import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../services/user-profile.service';
import { ToastService } from '../services/toast.service';
import { switchMap, map, take, catchError } from 'rxjs/operators';
import { from, of } from 'rxjs';

/**
 * Requires explicit onboarding completion and valid mandatory profile fields.
 * Si está autenticado pero su perfil está incompleto → redirige a /onboarding.
 * Si no está autenticado → redirige a /login.
 */
export const profileGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const profileService = inject(UserProfileService);
  const toast = inject(ToastService);

  return auth.authState$.pipe(
    take(1),
    switchMap(currentUser => {
      if (!currentUser) {
        return of(router.createUrlTree(['/login']));
      }
      return from(profileService.hasCompletedOnboarding()).pipe(
        map(completed => completed ? true : router.createUrlTree(['/onboarding']))
      );
    }),
    catchError(() => {
      toast.showError('No pudimos verificar tu perfil. Inicia sesión de nuevo para reintentar.');
      return of(router.createUrlTree(['/login']));
    })
  );
};
