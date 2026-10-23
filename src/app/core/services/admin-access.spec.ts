import { adminAccessForUser } from './admin-access';

describe('Administrator token access', () => {
  const legacy = 'cristiangarzon1231@gmail.com';
  const identity = (email: string, claims: Record<string, unknown>, emailVerified = true) => ({
    email, emailVerified, getIdTokenResult: async () => ({ claims }),
  });
  it('allows another administrator only with a boolean admin claim', async () => {
    expect(await adminAccessForUser(identity('Julli1230@gmail.com', { admin: true, vip: true }), legacy)).toBeTrue();
    for (const claims of [{ vip: true }, { admin: 'true' }, { role: 'admin', isVip: true }]) {
      expect(await adminAccessForUser(identity('Julli1230@gmail.com', claims), legacy)).toBeFalse();
    }
  });
  it('preserves verified access for the original administrator and rejects an unverified email', async () => {
    expect(await adminAccessForUser(identity(legacy, {}), legacy)).toBeTrue();
    expect(await adminAccessForUser(identity(legacy, {}, false), legacy)).toBeFalse();
  });
  it('denies unauthenticated sessions and token failures', async () => {
    expect(await adminAccessForUser(null, legacy)).toBeFalse();
    expect(await adminAccessForUser({ ...identity(legacy, {}),
      getIdTokenResult: async () => { throw new Error('Token unavailable'); } }, legacy)).toBeFalse();
  });
});
