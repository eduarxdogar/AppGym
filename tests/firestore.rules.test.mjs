import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, query, runTransaction, setDoc, setLogLevel, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
let owner;
let other;
let admin;
const protectedFields = {
  role: 'admin', isVip: true,
  subscriptionStatus: 'active', trialEndsAt: '2099-01-01T00:00:00Z', expiresAt: '2099-02-01T00:00:00Z',
  mpCustomerId: 'fake', subscriptionPaymentId: '1', subscriptionPaymentUpdatedAt: '2099-01-01T00:00:00Z',
  subscriptionPaymentApprovedAt: '2099-01-01T00:00:00Z',
};
before(async () => {
  setLogLevel('silent'); // Permission denials below are expected assertions.
  env = await initializeTestEnvironment({ projectId: 'demo-appgym-security', firestore: {
    rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  } });
  owner = env.authenticatedContext('alice').firestore();
  other = env.authenticatedContext('bob').firestore();
  admin = env.authenticatedContext('admin', { email: 'cristiangarzon1231@gmail.com', email_verified: true }).firestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice' });
    await setDoc(doc(db, 'users/alice/profile/data'), { weight: 70, ...protectedFields });
    await setDoc(doc(db, 'users/bob/profile/data'), { weight: 80 });
    await setDoc(doc(db, 'users/alice/nutritionLogs/day'), { calories: 2000 });
    await setDoc(doc(db, 'global_exercises/press'), { nombre: 'Press' });
    await setDoc(doc(db, 'exercises/squat'), { nombre: 'Squat' });
    await setDoc(doc(db, 'billing_accounts/alice'), { trialEndsAt: '2026-01-01' });
    for (const name of ['workouts', 'workout_history', 'cardio_sessions']) {
      await setDoc(doc(db, name, 'alice-session'), { userId: 'alice', volume: 100 });
      await setDoc(doc(db, name, 'bob-session'), { userId: 'bob', volume: 200 });
    }
  });
});
after(async () => { await env?.cleanup(); });

for (const [field, value] of Object.entries(protectedFields)) {
  test(`client cannot create, modify or remove billing field ${field}, including admin`, async () => {
    for (const db of [owner, admin]) {
      await assertFails(updateDoc(doc(db, 'users/alice/profile/data'), { [field]: value + 'changed' }));
      await assertFails(updateDoc(doc(db, 'users/alice/profile/data'), { [field]: deleteField() }));
      await assertFails(setDoc(doc(db, `users/alice/profile/new-${field}`), { [field]: value }));
      await assertFails(updateDoc(doc(db, 'users/alice'), { [field]: value }));
    }
  });
}
test('profile updates and full replacement preserving billing remain allowed', async () => {
  await assertSucceeds(updateDoc(doc(owner, 'users/alice/profile/data'), { weight: 71 }));
  await assertSucceeds(setDoc(doc(owner, 'users/alice/profile/data'), { weight: 72, ...protectedFields }));
  await assertFails(setDoc(doc(owner, 'users/alice/profile/data'), { weight: 70 }));
  await assertFails(deleteDoc(doc(owner, 'users/alice/profile/data')));
  await assertFails(deleteDoc(doc(owner, 'users/alice')));
  await assertSucceeds(setDoc(doc(owner, 'users/alice/profile/onboarding'), { weight: 70 }));
});
test('owner reads, subcollection reads, catalogs and admin collectionGroup reads remain allowed', async () => {
  await assertSucceeds(getDoc(doc(owner, 'users/alice/profile/data')));
  await assertSucceeds(getDoc(doc(owner, 'users/alice/nutritionLogs/day')));
  await assertSucceeds(getDocs(collection(owner, 'users/alice/profile')));
  await assertSucceeds(getDocs(collection(owner, 'exercises')));
  await assertSucceeds(getDocs(collection(owner, 'global_exercises')));
  await assertSucceeds(getDocs(collectionGroup(admin, 'profile')));
  await assertFails(getDoc(doc(other, 'users/alice/profile/data')));
  await assertFails(getDocs(collectionGroup(owner, 'profile')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice/profile/data')));
});
test('unverified email cannot obtain admin privileges', async () => {
  const unverified = env.authenticatedContext('fake-admin', { email: 'cristiangarzon1231@gmail.com', email_verified: false }).firestore();
  await assertFails(getDocs(collectionGroup(unverified, 'profile')));
});

test('signed administrator claims authorize delegated admins; VIP or editable roles cannot grant administration', async () => {
  const delegated = env.authenticatedContext('delegated-admin', { email: 'julli1230@gmail.com', admin: true, vip: true }).firestore();
  await assertSucceeds(getDocs(collectionGroup(delegated, 'profile')));
  await assertSucceeds(setDoc(doc(delegated, 'global_exercises/delegated-create'), { name: 'Exercise' }));
  await assertFails(updateDoc(doc(delegated, 'users/alice'), { isVip: true }));
  for (const claims of [{ vip: true }, { admin: 'true' }, { role: 'admin', isVip: true }]) {
    const forged = env.authenticatedContext('forged-admin', claims).firestore();
    await assertFails(getDocs(collectionGroup(forged, 'profile')));
    await assertFails(setDoc(doc(forged, 'global_exercises/forged'), { name: 'Forged' }));
  }
});

test('nutrition plans can be created, reloaded and updated only by their owner; daily consumption persists', async () => {
  const path = 'nutrition_plans/alice';
  const plan = { plan: { trainingDay: { totalCalories: 3000 }, restDay: { totalCalories: 2500 } },
    updatedAt: '2026-10-20T00:00:00Z' };
  await assertSucceeds(getDoc(doc(owner, path)));
  await assertSucceeds(setDoc(doc(owner, path), plan));
  await assertSucceeds(getDoc(doc(owner, path)));
  await assertSucceeds(setDoc(doc(owner, path), { ...plan, updatedAt: '2026-10-20T01:00:00Z' }));
  await assertFails(getDoc(doc(other, path)));
  await assertFails(setDoc(doc(other, path), plan));
  await assertFails(deleteDoc(doc(other, path)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
  await assertFails(setDoc(doc(owner, path), { ...plan, subscriptionStatus: 'vip' }));
  const log = { date: '2026-10-19', consumedCalories: 650, consumedProtein: 45,
    consumedCarbs: 80, consumedFats: 20, consumedMeals: { 0: true } };
  await assertSucceeds(setDoc(doc(owner, 'users/alice/nutritionLogs/2026-10-19'), log));
  await assertSucceeds(getDoc(doc(owner, 'users/alice/nutritionLogs/2026-10-19')));
  await assertFails(setDoc(doc(other, 'users/alice/nutritionLogs/2026-10-19'), log));
});

test('lifetime VIP cannot be granted by a client, including the administrator', async () => {
  for (const db of [owner, admin]) {
    await assertFails(updateDoc(doc(db, 'users/alice/profile/data'), { subscriptionStatus: 'vip' }));
    await assertFails(setDoc(doc(db, 'users/alice/profile/vip'), { subscriptionStatus: 'vip' }));
  }
});

test('workout chat supports atomic owner exchanges while denying foreign or forged messages', async () => {
  const message = (id, role) => ({ id, workoutId: 'alice-session', userId: 'alice', role,
    text: 'Mensaje de prueba', timestamp: '2026-10-19T12:00:00Z' });
  const path = 'workouts/alice-session/chat_history';
  const exchange = writeBatch(owner);
  exchange.set(doc(owner, path, 'user-turn'), message('user-turn', 'user'));
  exchange.set(doc(owner, path, 'coach-turn'), message('coach-turn', 'coach'));
  await assertSucceeds(exchange.commit());
  await assertSucceeds(getDocs(collection(owner, path)));
  await assertSucceeds(getDocs(collection(admin, path)));
  await assertFails(getDocs(collection(other, path)));
  await assertFails(setDoc(doc(other, path, 'foreign'), { ...message('foreign', 'user'), userId: 'bob' }));
  await assertFails(setDoc(doc(owner, path, 'forged'), { ...message('forged', 'user'), userId: 'bob' }));
  await assertFails(setDoc(doc(owner, 'workouts/bob-session/chat_history/foreign'), { ...message('foreign', 'user'), workoutId: 'bob-session' }));
  const invalid = writeBatch(owner);
  invalid.set(doc(owner, path, 'valid-half'), message('valid-half', 'user'));
  invalid.set(doc(owner, path, 'invalid-half'), message('invalid-half', 'admin'));
  await assertFails(invalid.commit());
  const missing = await assertSucceeds(getDoc(doc(owner, path, 'valid-half')));
  if (missing.exists()) throw new Error('Partial chat exchange was stored');
});

test('first workout completion can read an absent stable history ID and commits once, without foreign reads', async () => {
  const history = doc(owner, 'workout_history/first-completion');
  const workout = doc(owner, 'workouts/alice-session');
  const complete = () => runTransaction(owner, async transaction => {
    const current = await transaction.get(workout);
    const saved = await transaction.get(history);
    if (saved.exists()) return;
    if (current.get('userId') !== 'alice') throw new Error('Wrong owner');
    transaction.set(history, { userId: 'alice', totalVolume: 624 });
    transaction.update(workout, { status: 'completed', lastSessionId: 'first-completion' });
  });
  await assertSucceeds(complete());
  await assertSucceeds(complete());
  const saved = await assertSucceeds(getDoc(history));
  if (saved.get('totalVolume') !== 624) throw new Error('History was not committed');
  await assertFails(getDoc(doc(other, 'workout_history/first-completion')));
  await assertFails(getDocs(collection(other, 'workout_history')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'workout_history/not-created')));
});
for (const name of ['workouts', 'workout_history', 'cardio_sessions']) {
  test(`${name}: owner is immutable, including admin, while existing owner queries and updates work`, async () => {
    await assertSucceeds(getDocs(query(collection(owner, name), where('userId', '==', 'alice'))));
    await assertSucceeds(getDocs(collection(admin, name)));
    await assertSucceeds(updateDoc(doc(owner, name, 'alice-session'), { volume: 300 }));
    await assertFails(updateDoc(doc(owner, name, 'alice-session'), { userId: 'bob' }));
    await assertFails(updateDoc(doc(admin, name, 'alice-session'), { userId: 'bob' }));
    await assertFails(updateDoc(doc(owner, name, 'alice-session'), { userId: deleteField() }));
    await assertFails(updateDoc(doc(other, name, 'alice-session'), { volume: 400 }));
    await assertFails(setDoc(doc(owner, name, 'forged-owner'), { userId: 'bob' }));
    await assertSucceeds(setDoc(doc(owner, name, 'own-new'), { userId: 'alice' }));
  });
}
test('a mixed malicious batch is rejected atomically; valid training completion still commits', async () => {
  const bad = writeBatch(owner);
  bad.set(doc(owner, 'workout_history/batch-history'), { userId: 'alice' });
  bad.update(doc(owner, 'users/alice/profile/data'), { subscriptionStatus: 'trialing' });
  await assertFails(bad.commit());
  await env.withSecurityRulesDisabled(async context => {
    const snap = await getDoc(doc(context.firestore(), 'workout_history/batch-history'));
    if (snap.exists()) throw new Error('Partial unauthorized commit');
  });
  const good = writeBatch(owner);
  good.set(doc(owner, 'workout_history/valid-history'), { userId: 'alice' });
  good.update(doc(owner, 'workouts/alice-session'), { completed: true });
  good.set(doc(owner, 'workouts/calendar-next'), { userId: 'alice' });
  await assertSucceeds(good.commit());
});
test('only trusted server context writes billing; private trial marker cannot be reset', async () => {
  await assertFails(deleteDoc(doc(owner, 'billing_accounts/alice')));
  await assertFails(setDoc(doc(admin, 'billing_accounts/alice'), { trialEndsAt: '2099-01-01' }));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/alice/profile/data'), { subscriptionStatus: 'canceled' }, { merge: true });
  });
  await assertSucceeds(getDoc(doc(owner, 'users/alice/profile/data')));
});
