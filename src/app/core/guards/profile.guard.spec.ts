import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { profileGuard } from './profile.guard';
import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../services/user-profile.service';
import { ToastService } from '../services/toast.service';

describe('ProfileGuard', () => {
  let auth: { authState$: Observable<unknown> };
  let check: jasmine.Spy;
  let toast: jasmine.Spy;
  let router: Router;
  const run = () => firstValueFrom(TestBed.runInInjectionContext(() =>
    profileGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>);
  beforeEach(() => {
    auth = { authState$: of({ uid: 'test-user' }) };
    check = jasmine.createSpy('hasCompletedOnboarding').and.resolveTo(false);
    toast = jasmine.createSpy('showError');
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: UserProfileService, useValue: { hasCompletedOnboarding: check } },
      { provide: ToastService, useValue: { showError: toast } },
    ] });
    router = TestBed.inject(Router);
  });
  it('redirects unauthenticated visitors without querying Firestore', async () => {
    auth.authState$ = of(null);
    expect(router.serializeUrl(await run() as UrlTree)).toBe('/login');
    expect(check).not.toHaveBeenCalled();
  });
  it('redirects incomplete or billing-only profiles to onboarding', async () => {
    expect(router.serializeUrl(await run() as UrlTree)).toBe('/onboarding');
    expect(check).toHaveBeenCalledTimes(1);
  });
  it('allows a validated, explicitly completed onboarding', async () => {
    check.and.resolveTo(true);
    expect(await run()).toBeTrue();
  });
  it('handles profile/auth errors with a message and a safe redirect', async () => {
    check.and.rejectWith(new Error('offline'));
    expect(router.serializeUrl(await run() as UrlTree)).toBe('/login');
    expect(toast).toHaveBeenCalledTimes(1);
    auth.authState$ = throwError(() => new Error('auth error'));
    expect(router.serializeUrl(await run() as UrlTree)).toBe('/login');
    expect(toast).toHaveBeenCalledTimes(2);
  });
});
