import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SubscriptionService } from '../services/subscription.service';

export const subscriptionGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  return subscriptionService.hasAccess$.pipe(
    map(hasAccess => {
      if (hasAccess) {
        return true;
      }
      return router.createUrlTree(['/billing']);
    })
  );
};
