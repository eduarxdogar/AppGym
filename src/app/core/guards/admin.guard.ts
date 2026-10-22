import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/** Uses the same signed-token decision as the administrative menu. */
export const adminGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.isAdmin$.pipe(
    take(1),
    map(isAdmin => {
      if (isAdmin) {
        return true;
      }
      return router.createUrlTree(['/dashboard']);
    })
  );
};
