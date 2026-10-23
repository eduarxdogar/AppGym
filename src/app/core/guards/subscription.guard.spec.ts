import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SubscriptionService, SubscriptionState } from '../services/subscription.service';
import { ToastService } from '../services/toast.service';
import { subscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard', () => {
  const state = signal<SubscriptionState>('loading');
  let initialize: jasmine.Spy;
  let toast: jasmine.Spy;
  let router: Router;
  const run = () => firstValueFrom(TestBed.runInInjectionContext(() =>
    subscriptionGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>);
  beforeEach(() => {
    state.set('loading');
    initialize = jasmine.createSpy('initialize').and.resolveTo();
    toast = jasmine.createSpy('showError');
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: SubscriptionService, useValue: { subscriptionState: state } },
      { provide: AuthService, useValue: { ensureSubscriptionInitialized: initialize } },
      { provide: ToastService, useValue: { showError: toast } },
    ] });
    router = TestBed.inject(Router);
  });
  for (const access of ['vip', 'active', 'trialing'] as const) {
    it(`allows ${access} without sending the user to checkout`, async () => {
      state.set(access);
      const result = run();
      TestBed.flushEffects();
      expect(await result).toBeTrue();
    });
  }
  it('waits for server initialization before deciding that access has expired', async () => {
    state.set('expired');
    let finish!: () => void;
    initialize.and.returnValue(new Promise<void>(resolve => { finish = resolve; }));
    const result = run();
    TestBed.flushEffects();
    state.set('trialing');
    finish();
    TestBed.flushEffects();
    expect(await result).toBeTrue();
  });
  it('sends expired access to billing', async () => {
    state.set('expired');
    const result = run();
    TestBed.flushEffects();
    expect(router.serializeUrl(await result as UrlTree)).toBe('/billing');
  });
  it('reports initialization errors instead of treating them as an expired trial', async () => {
    initialize.and.rejectWith(new Error('offline'));
    expect(router.serializeUrl(await run() as UrlTree)).toBe('/login');
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
