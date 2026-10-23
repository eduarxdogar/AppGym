'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setupAdmin, setupAccounts } = require('./setup-admins');

function fixture() {
  const user = { uid: 'test-admin', email: 'admin@example.test', customClaims: { coach: true } };
  const records = new Map([
    ['users/test-admin', { displayName: 'Existing user' }],
    ['users/test-admin/profile/data', { weight: 75, subscriptionStatus: 'trialing', trialEndsAt: '2026-10-27' }],
  ]);
  let grants = 0;
  let rejectCommit = false;
  const snapshot = ref => ({ get: key => records.get(ref.path)?.[key] });
  const db = {
    doc: path => ({ path, get: async () => snapshot({ path }) }),
    runTransaction: async callback => {
      const writes = [];
      await callback({ get: async ref => snapshot(ref), set: (ref, data, options) => writes.push({ ref, data, options }) });
      if (rejectCommit) throw new Error('Simulated failed commit');
      for (const { ref, data, options } of writes) {
        assert.equal(options.merge, true);
        records.set(ref.path, { ...records.get(ref.path), ...data });
      }
    },
  };
  const auth = {
    setCustomUserClaims: async (uid, claims) => { assert.equal(uid, user.uid); grants++; user.customClaims = claims; },
    getUser: async uid => { assert.equal(uid, user.uid); return user; },
  };
  return { user, db, auth, records, grants: () => grants, failCommit: value => { rejectCommit = value; } };
}

test('repeated execution preserves existing claims and profile data and grants lifetime access', async () => {
  const f = fixture();
  for (let attempt = 0; attempt < 2; attempt++) await setupAdmin(f.auth, f.db, f.user, () => {});
  assert.deepEqual(f.user.customClaims, { coach: true, admin: true, vip: true });
  assert.equal(f.grants(), 1);
  assert.deepEqual(f.records.get('users/test-admin'), {
    displayName: 'Existing user', role: 'admin', subscriptionStatus: 'active', trialEndsAt: null, isVip: true,
  });
  assert.deepEqual(f.records.get('users/test-admin/profile/data'), {
    weight: 75, subscriptionStatus: 'vip', trialEndsAt: null, expiresAt: null,
  });
});

test('an existing admin without VIP receives the missing VIP claim without losing other claims', async () => {
  const f = fixture();
  f.user.customClaims.admin = true;
  await setupAdmin(f.auth, f.db, f.user, () => {});
  assert.deepEqual(f.user.customClaims, { coach: true, admin: true, vip: true });
});

test('a missing email prints registration instructions and does not prevent configuring the next account', async () => {
  const f = fixture();
  const errors = [];
  f.auth.getUserByEmail = async email => {
    if (email === 'missing@example.test') throw Object.assign(new Error('Missing user'), { code: 'auth/user-not-found' });
    return f.user;
  };
  const result = await setupAccounts(f.auth, f.db, ['missing@example.test', f.user.email], () => {}, message => errors.push(message));
  assert.deepEqual(result, { configured: 1, failures: 1 });
  assert.match(errors[0], /missing@example.test.*registrarse primero/);
  assert.equal(f.user.customClaims.vip, true);
});

test('a failed Firestore commit leaves both documents intact and a rerun completes the grant', async () => {
  const f = fixture();
  f.failCommit(true);
  await assert.rejects(setupAdmin(f.auth, f.db, f.user, () => {}), /failed commit/);
  assert.equal(f.records.get('users/test-admin').subscriptionStatus, undefined);
  assert.equal(f.records.get('users/test-admin/profile/data').subscriptionStatus, 'trialing');
  f.failCommit(false);
  await setupAdmin(f.auth, f.db, f.user, () => {});
  assert.equal(f.grants(), 1);
  assert.equal(f.records.get('users/test-admin/profile/data').subscriptionStatus, 'vip');
});

test('disabled or deleted accounts are not silently reactivated or granted new claims', async () => {
  for (const disabled of [true, false]) {
    const f = fixture();
    if (disabled) f.user.disabled = true;
    else f.records.get('users/test-admin/profile/data').isDeleted = true;
    await assert.rejects(setupAdmin(f.auth, f.db, f.user, () => {}), /deshabilitada|eliminado/);
    assert.equal(f.grants(), 0);
    assert.equal(f.records.get('users/test-admin').isVip, undefined);
  }
});
