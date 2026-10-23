import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserProfile } from '../models/user-profile.model';
import { SubscriptionService } from './subscription.service';
import { TrainingClockService } from './training-clock.service';
import { UserProfileStateService } from './user-profile-state.service';

describe('SubscriptionService', () => {
  const now = signal(Date.parse('2026-10-19T12:00:00Z'));
  const profile = signal<UserProfile | null | undefined>(undefined);
  let service: SubscriptionService;
  beforeEach(() => {
    now.set(Date.parse('2026-10-19T12:00:00Z')); profile.set(undefined);
    TestBed.configureTestingModule({ providers: [
      { provide: TrainingClockService, useValue: { now } },
      { provide: UserProfileStateService, useValue: { profile } },
    ] });
    service = TestBed.inject(SubscriptionService);
  });
  it('expires a paid subscription by time and observes refunds immediately', () => {
    expect(service.subscriptionState()).toBe('loading');
    profile.set({ subscriptionStatus: 'active', expiresAt: '2026-10-20T00:00:00Z' } as UserProfile);
    expect(service.hasAccess()).toBeTrue();
    now.set(Date.parse('2026-10-20T00:00:00Z'));
    expect(service.hasAccess()).toBeFalse();
    now.set(Date.parse('2026-10-19T12:00:00Z'));
    profile.update(value => ({ ...value, subscriptionStatus: 'refunded' } as UserProfile));
    expect(service.hasAccess()).toBeFalse();
  });
  it('denies legacy indefinite payments, invalid dates and deleted accounts', () => {
    for (const extra of [{}, { expiresAt: 'bad' }, { expiresAt: '2099-01-01', isDeleted: true }]) {
      profile.set({ subscriptionStatus: 'active', ...extra } as UserProfile);
      expect(service.hasAccess()).toBeFalse();
    }
  });
  it('keeps a valid trial and expires it at its exact endpoint', () => {
    profile.set({ subscriptionStatus: 'trialing', trialEndsAt: '2026-10-20T00:00:00Z' } as UserProfile);
    expect(service.subscriptionState()).toBe('trialing');
    expect(service.trialDaysRemaining()).toBe(1);
    expect(service.isVip()).toBeFalse();
    now.set(Date.parse('2026-10-20T00:00:00Z'));
    expect(service.hasAccess()).toBeFalse();
    expect(service.trialDaysRemaining()).toBeNull();
  });

  it('keeps lifetime VIP active without an expiration and still rejects deleted accounts', () => {
    profile.set({ subscriptionStatus: 'vip', expiresAt: null, trialEndsAt: null } as UserProfile);
    now.set(Date.parse('2099-01-01T00:00:00Z'));
    expect(service.subscriptionState()).toBe('vip');
    expect(service.hasAccess()).toBeTrue();
    expect(service.isVip()).toBeTrue();
    expect(service.trialDaysRemaining()).toBeNull();
    profile.update(value => ({ ...value, isDeleted: true } as UserProfile));
    expect(service.hasAccess()).toBeFalse();
  });

  it('shows all seven trial days and updates the countdown without reloading the profile', () => {
    profile.set({ subscriptionStatus: 'trialing', trialEndsAt: '2026-10-26T12:00:00Z' } as UserProfile);
    expect(service.hasAccess()).toBeTrue();
    expect(service.trialDaysRemaining()).toBe(7);
    now.set(Date.parse('2026-10-25T12:00:01Z'));
    expect(service.trialDaysRemaining()).toBe(1);
    now.set(Date.parse('2026-10-26T12:00:00Z'));
    expect(service.subscriptionState()).toBe('expired');
    expect(service.isVip()).toBeFalse();
  });
});
