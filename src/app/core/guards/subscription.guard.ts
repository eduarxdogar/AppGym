import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { SubscriptionService } from '../services/subscription.service';

export const subscriptionGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  return toObservable(subscriptionService.subscriptionState).pipe(
    // Esperamos hasta que el estado deje de ser 'loading' (perfil ya cargó)
    filter(state => state !== 'loading'),
    take(1),
    map(state => {
      if (state === 'active' || state === 'trialing') {
        return true;
      }
      return router.createUrlTree(['/billing']);
    })
  );
};
