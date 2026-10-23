import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { from, Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { SubscriptionService } from '../services/subscription.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const subscriptionGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const state$ = toObservable(subscriptionService.subscriptionState);

  return from(auth.ensureSubscriptionInitialized()).pipe(
    switchMap(() => state$),
    // A replayed emission must not use the profile from before server initialization.
    map(() => subscriptionService.subscriptionState()),
    // Esperamos hasta que el estado deje de ser 'loading' (perfil ya cargó)
    filter(state => state !== 'loading'),
    take(1),
    map(state => {
      if (state === 'vip' || state === 'active' || state === 'trialing') {
        return true;
      }
      return router.createUrlTree(['/billing']);
    }),
    catchError(() => {
      toast.showError('No pudimos verificar tu acceso. Inicia sesión de nuevo para reintentar.');
      return of(router.createUrlTree(['/login']));
    })
  );
};
