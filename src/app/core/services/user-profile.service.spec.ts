import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { UserProfile } from '../models/user-profile.model';
import { isOnboardingComplete } from '../models/onboarding.validation';
import { profileWriteData, UserProfileService } from './user-profile.service';

describe('UserProfileService onboarding contract', () => {
  const valid: UserProfile = { weight: 75, height: 175, goal: 'volumen', fitnessLevel: 'Intermedio',
    availableDays: ['Lunes'], equipment: [], onboardingCompleted: true };
  it('requires the completion flag as well as every mandatory field', () => {
    expect(isOnboardingComplete(valid)).toBeTrue();
    for (const profile of [null, {}, { subscriptionStatus: 'trialing' }, { ...valid, onboardingCompleted: undefined },
      { ...valid, onboardingCompleted: false }, { ...valid, weight: undefined }, { ...valid, goal: undefined },
      { ...valid, fitnessLevel: undefined }, { ...valid, availableDays: undefined }]) {
      expect(isOnboardingComplete(profile)).toBeFalse();
    }
  });
  it('rejects invalid numbers, enums, days and soft-deleted profiles', () => {
    for (const extra of [{ weight: 0 }, { weight: -1 }, { weight: NaN }, { weight: Infinity }, { weight: '75' },
      { goal: 'unknown' }, { fitnessLevel: 'elite' }, { availableDays: [] }, { availableDays: [''] },
      { availableDays: ['Lunes', 'Lunes'] }, { availableDays: ['Cualquiera'] }, { isDeleted: true }]) {
      expect(isOnboardingComplete({ ...valid, ...extra })).toBeFalse();
    }
  });
  it('removes undefined recursively and excludes billing fields without altering source data', () => {
    const input: UserProfile = { ...valid, age: undefined, subscriptionStatus: 'active', expiresAt: '2099-01-01',
      trialEndsAt: null, mpCustomerId: 'private', subscriptionPaymentId: '1', subscriptionPaymentUpdatedAt: 'now',
      subscriptionPaymentApprovedAt: 'now', inbodyData: { muscleKg: 0, bmr: null,
        segmentalFat: undefined, segmentalMuscle: { rightArm: undefined, leftArm: null } } };
    const result = profileWriteData(input);
    expect(result).toEqual({ ...valid, inbodyData: { muscleKg: 0, bmr: null, segmentalMuscle: { leftArm: null } } });
    expect(input.inbodyData?.segmentalMuscle).toEqual({ rightArm: undefined, leftArm: null });
  });
  it('rejects a forged completion flag before attempting a Firestore write', async () => {
    TestBed.configureTestingModule({ providers: [
      { provide: Firestore, useValue: {} }, { provide: Auth, useValue: { currentUser: { uid: 'test-user' } } },
    ] });
    await expectAsync(TestBed.inject(UserProfileService).saveProfile({ ...valid, availableDays: [] }))
      .toBeRejectedWithError('Completa un peso válido, objetivo, nivel y al menos un día disponible.');
  });
});
