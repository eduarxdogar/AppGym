import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { UserProfileService } from '../services/user-profile.service';
import { switchMap, map, take } from 'rxjs/operators';
import { from } from 'rxjs';

/**
 * Guard que verifica si el usuario tiene un perfil creado.
 * Si está autenticado pero no tiene perfil → redirige a /onboarding.
 * Si no está autenticado → redirige a /login.
 */
export const profileGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(Auth);
  const profileService = inject(UserProfileService);

  return authState(auth).pipe(
    take(1),
    switchMap(currentUser => {
      if (!currentUser) {
        router.navigate(['/login']);
        return [false];
      }
      return from(profileService.profileExists()).pipe(
        map(exists => {
          if (!exists) {
            router.navigate(['/onboarding']);
            return false;
          }
          return true;
        })
      );
    })
  );
};
