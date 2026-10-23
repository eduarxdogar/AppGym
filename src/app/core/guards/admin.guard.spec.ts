import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { adminGuard } from './admin.guard';

describe('AdminGuard', () => {
  for (const allowed of [true, false]) {
    it(allowed ? 'allows the signed-token administrator decision' : 'redirects a regular user to the dashboard', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]),
        { provide: AuthService, useValue: { isAdmin$: of(allowed) } },
      ] });
      const result = await firstValueFrom(TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>);
      if (allowed) expect(result).toBeTrue();
      else expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard');
    });
  }
});
