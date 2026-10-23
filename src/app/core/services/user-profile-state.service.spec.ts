import { TestBed } from '@angular/core/testing';
import { Observable, Subscriber } from 'rxjs';
import { UserProfile } from '../models/user-profile.model';
import { UserProfileService } from './user-profile.service';
import { UserProfileStateService } from './user-profile-state.service';

describe('UserProfileStateService', () => {
  it('keeps one live subscription across refreshes and releases it on destruction', () => {
    let live = 0;
    let subscriber: Subscriber<UserProfile | null>;
    const getProfile = () => new Observable<UserProfile | null>(next => {
      live++; subscriber = next; return () => live--;
    });
    TestBed.configureTestingModule({ providers: [{ provide: UserProfileService, useValue: { getProfile } }] });
    const state = TestBed.inject(UserProfileStateService);
    expect(live).toBe(1);
    state.refreshProfile(); state.refreshProfile();
    expect(live).toBe(1);
    subscriber!.next({ subscriptionStatus: 'refunded' } as UserProfile);
    expect(state.profile()?.subscriptionStatus).toBe('refunded');
    TestBed.resetTestingModule();
    expect(live).toBe(0);
  });
});
