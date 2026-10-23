import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== 'demo-appgym-security') {
  throw new Error('Billing integration tests require the demo Firestore emulator');
}
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
const { initializeSubscription, callGemini, createCheckoutSession, generateWorkoutPlanAI,
  generateNutritionPlanAI, generateBoxingPlanAI, chatAI, analyzeInbodyAI, analyzeNutritionLabelAI } = require('./lib/index');
const { applyPayment } = require('./lib/billing-store');
const db = admin.firestore();
const serverAuth = admin.auth();
const originalGetUser = serverAuth.getUser;
const registeredAt = new Date().toISOString();
const registrations = new Map();
before(() => {
  serverAuth.getUser = async uid => ({ uid, email: uid === 'server-vip-admin' || uid === 'server-unverified-admin'
    ? 'cristiangarzon1231@gmail.com' : 'test@example.com', emailVerified: uid !== 'server-unverified-admin',
    disabled: false, customClaims: uid === 'server-claimed-vip' ? { admin: true, vip: true } : {},
    metadata: { creationTime: registrations.get(uid) ?? registeredAt } });
});
after(async () => {
  serverAuth.getUser = originalGetUser;
  await Promise.all(admin.apps.map(app => app.delete()));
});

test('server trial initialization is atomic, idempotent and cannot restart after profile deletion', async () => {
  const uid = 'server-trial-test';
  const profile = db.doc(`users/${uid}/profile/data`);
  const marker = db.doc(`billing_accounts/${uid}`);
  await profile.delete(); await marker.delete();
  const request = { auth: { uid, token: {} }, data: {} };
  await Promise.all([initializeSubscription.run(request), initializeSubscription.run(request)]);
  const first = (await profile.get()).data();
  assert.equal(first.subscriptionStatus, 'trialing');
  assert.equal(Date.parse(first.trialEndsAt), Date.parse(registeredAt) + 7 * 86400000);
  await initializeSubscription.run(request);
  assert.deepEqual((await profile.get()).data(), first);
  await profile.delete();
  await initializeSubscription.run(request);
  assert.equal((await profile.get()).get('trialEndsAt'), first.trialEndsAt);
});

test('verified administrator is lifetime VIP, preserves profile data and cannot be downgraded by a webhook', async () => {
  const uid = 'server-vip-admin';
  const ref = db.doc(`users/${uid}/profile/data`);
  await ref.set({ subscriptionStatus: 'active', weight: 70 });
  await db.doc(`billing_accounts/${uid}`).delete();
  const request = { auth: { uid, token: {} }, data: {} };
  await Promise.all([initializeSubscription.run(request), initializeSubscription.run(request)]);
  const vip = (await ref.get()).data();
  assert.deepEqual(vip, { subscriptionStatus: 'vip', weight: 70, trialEndsAt: null, expiresAt: null });
  await initializeSubscription.run(request);
  assert.deepEqual((await ref.get()).data(), vip);
  const payment = { id: 999, external_reference: uid, transaction_amount: 30000, currency_id: 'COP',
    date_approved: registeredAt, date_last_updated: registeredAt };
  for (const status of ['approved', 'refunded', 'charged_back']) await applyPayment(db, { ...payment, status });
  assert.deepEqual((await ref.get()).data(), vip);
});

test('a second account receives permanent VIP from Admin Auth claims rather than client-provided roles', async () => {
  const uid = 'server-claimed-vip';
  const ref = db.doc(`users/${uid}/profile/data`);
  await ref.set({ weight: 80, subscriptionStatus: 'trialing' });
  await initializeSubscription.run({ auth: { uid, token: {} }, data: {} });
  assert.equal((await ref.get()).get('subscriptionStatus'), 'vip');
  assert.equal((await ref.get()).get('expiresAt'), null);
  const forgedUid = 'server-client-forged-vip';
  const forged = db.doc(`users/${forgedUid}/profile/data`);
  await forged.delete();
  await initializeSubscription.run({ auth: { uid: forgedUid, token: { vip: true, admin: true } },
    data: { role: 'admin', isVip: true } });
  assert.equal((await forged.get()).get('subscriptionStatus'), 'trialing');
});

test('trial uses the first Auth registration, repairs missing dates and never restarts at a new login', async () => {
  const uid = 'server-old-registration';
  const creationTime = new Date(Date.now() - 8 * 86400000).toISOString();
  registrations.set(uid, creationTime);
  const ref = db.doc(`users/${uid}/profile/data`);
  await ref.set({ subscriptionStatus: 'trialing' });
  await db.doc(`billing_accounts/${uid}`).delete();
  const request = { auth: { uid, token: { auth_time: Date.now() / 1000 } }, data: {} };
  await initializeSubscription.run(request);
  const expectedEnd = new Date(Date.parse(creationTime) + 7 * 86400000).toISOString();
  assert.equal((await ref.get()).get('trialEndsAt'), expectedEnd);
  await ref.delete();
  await initializeSubscription.run(request);
  assert.equal((await ref.get()).get('trialEndsAt'), expectedEnd);
});

test('client email claims and an unverified administrator email cannot grant lifetime VIP', async () => {
  for (const uid of ['server-unverified-admin', 'server-forged-admin']) {
    const ref = db.doc(`users/${uid}/profile/data`);
    await ref.delete(); await db.doc(`billing_accounts/${uid}`).delete();
    await initializeSubscription.run({ auth: { uid, token: {
      email: 'cristiangarzon1231@gmail.com', email_verified: true,
    } }, data: { subscriptionStatus: 'vip' } });
    assert.equal((await ref.get()).get('subscriptionStatus'), 'trialing');
  }
});

test('checkout rejects VIP and valid trial or paid access before contacting Mercado Pago', async () => {
  const uid = 'server-checkout-access';
  const ref = db.doc(`users/${uid}/profile/data`);
  const future = new Date(Date.now() + 86400000).toISOString();
  for (const profile of [{ subscriptionStatus: 'vip' }, { subscriptionStatus: 'trialing', trialEndsAt: future },
    { subscriptionStatus: 'active', expiresAt: future }]) {
    await ref.set(profile);
    await assert.rejects(createCheckoutSession.run({ auth: { uid, token: {} }, data: {} }),
      error => error.code === 'failed-precondition');
  }
});

test('checkout initializes a missing trial first and never creates a payment during first registration', async () => {
  const uid = 'server-first-login-checkout';
  const ref = db.doc(`users/${uid}/profile/data`);
  await ref.delete(); await db.doc(`billing_accounts/${uid}`).delete();
  await assert.rejects(createCheckoutSession.run({ auth: { uid, token: {} }, data: {} }),
    error => error.code === 'failed-precondition');
  const profile = (await ref.get()).data();
  assert.equal(profile.subscriptionStatus, 'trialing');
  assert.equal(Date.parse(profile.trialEndsAt), Date.parse(registeredAt) + 7 * 86400000);
});

test('checkout allows an expired trial or paid period and sends the authenticated UID and fixed price', async () => {
  const { Preference } = require('mercadopago');
  const originalCreate = Preference.prototype.create;
  const originalToken = process.env.MP_ACCESS_TOKEN;
  const uid = 'server-expired-checkout';
  const ref = db.doc(`users/${uid}/profile/data`);
  const past = new Date(Date.now() - 1).toISOString();
  let calls = 0;
  try {
    process.env.MP_ACCESS_TOKEN = 'emulator-fake-payment-token';
    Preference.prototype.create = async ({ body }) => {
      calls++;
      assert.equal(body.external_reference, uid);
      assert.equal(body.items[0].unit_price, 30000);
      assert.equal(body.items[0].currency_id, 'COP');
      return { init_point: 'https://sandbox.mercadopago.com.co/test-checkout' };
    };
    for (const profile of [{ subscriptionStatus: 'trialing', trialEndsAt: past },
      { subscriptionStatus: 'active', expiresAt: past }]) {
      await ref.set(profile);
      assert.deepEqual(await createCheckoutSession.run({ auth: { uid, token: {} }, data: {} }),
        { init_point: 'https://sandbox.mercadopago.com.co/test-checkout' });
    }
    assert.equal(calls, 2);
  } finally {
    Preference.prototype.create = originalCreate;
    if (originalToken === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = originalToken;
  }
});
test('initialization preserves a paid account and its server billing fields', async () => {
  const uid = 'server-paid-test';
  const profile = db.doc(`users/${uid}/profile/data`);
  const paid = { subscriptionStatus: 'active', expiresAt: '2099-01-01T00:00:00Z', subscriptionPaymentId: '42' };
  await profile.set(paid);
  await db.doc(`billing_accounts/${uid}`).delete();
  await initializeSubscription.run({ auth: { uid, token: {} }, data: {} });
  assert.deepEqual((await profile.get()).data(), paid);
});
test('unauthenticated initialization is denied', async () => {
  await assert.rejects(initializeSubscription.run({ data: {} }), error => error.code === 'unauthenticated');
});

test('concurrent webhook deliveries persist one expiration and refund atomically revokes that payment', async () => {
  const uid = 'server-payment-test';
  const ref = db.doc(`users/${uid}/profile/data`);
  await ref.set({ weight: 70, subscriptionStatus: 'trialing' });
  const payment = { id: 123456, external_reference: uid, status: 'approved', transaction_amount: 30000,
    currency_id: 'COP', date_approved: '2026-10-19T10:00:00Z', date_last_updated: '2026-10-19T10:01:00Z' };
  await Promise.all([applyPayment(db, payment), applyPayment(db, payment)]);
  const first = (await ref.get()).data();
  assert.equal(first.expiresAt, '2026-11-18T10:00:00.000Z');
  assert.equal(first.weight, 70);
  await applyPayment(db, { ...payment, status: 'refunded', date_last_updated: '2026-10-20T00:00:00Z' });
  await applyPayment(db, payment);
  assert.equal((await ref.get()).get('subscriptionStatus'), 'refunded');
});
test('payment validation errors do not partially modify the profile', async () => {
  const ref = db.doc('users/server-invalid-payment/profile/data');
  const before = { subscriptionStatus: 'trialing', weight: 70 };
  await ref.set(before);
  await assert.rejects(applyPayment(db, { id: 123, external_reference: 'server-invalid-payment',
    status: 'approved', transaction_amount: 1, currency_id: 'COP' }));
  assert.deepEqual((await ref.get()).data(), before);
});

test('callGemini rejects unauthenticated and invalid payloads before consuming the provider', async () => {
  await assert.rejects(callGemini.run({ data: {} }), error => error.code === 'unauthenticated');
  for (const data of [{}, { prompt: 'x'.repeat(65537), model: 'gemini-2.5-flash', isJson: true },
    { prompt: 'test', model: 'gemini-2.5-flash', isJson: true, userId: 'victim' }]) {
    await assert.rejects(callGemini.run({ auth: { uid: 'invalid-ai-payload', token: {} }, data }), error => error.code === 'invalid-argument');
  }
});
test('callGemini only consumes the provider for the authenticated user with an unexpired trial or paid period', async () => {
  const data = { prompt: 'test', model: 'gemini-2.5-flash', isJson: true };
  const uid = 'server-ai-access-test';
  const ref = db.doc(`users/${uid}/profile/data`);
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const originalFetch = globalThis.fetch;
  const names = ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
  const originalKeys = names.map(name => process.env[name]);
  let calls = 0;
  try {
    names.forEach((name, index) => { process.env[name] = `emulator-fake-key-${index}`; });
    globalThis.fetch = async url => {
      assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
      calls++;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"unitTest":true}' } }] }));
    };
    for (const profile of [{ subscriptionStatus: 'vip' }, { subscriptionStatus: 'active', expiresAt: future }, { subscriptionStatus: 'trialing', trialEndsAt: future }]) {
      await ref.set(profile);
      assert.deepEqual(await callGemini.run({ auth: { uid, token: {} }, data }), { text: '{"unitTest":true}' });
    }
    assert.equal(calls, 3);
    const adminToken = { email: 'cristiangarzon1231@gmail.com', email_verified: true };
    for (const profile of [{}, { subscriptionStatus: 'active' }, { subscriptionStatus: 'active', expiresAt: past },
      { subscriptionStatus: 'trialing', trialEndsAt: past }, { subscriptionStatus: 'refunded', expiresAt: future },
      { subscriptionStatus: 'active', expiresAt: future, isDeleted: true }]) {
      await ref.set(profile);
      await assert.rejects(callGemini.run({ auth: { uid, token: adminToken }, data }), error => error.code === 'permission-denied');
    }
    await ref.delete();
    await assert.rejects(callGemini.run({ auth: { uid, token: {} }, data }), error => error.code === 'permission-denied');
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (originalKeys[index] === undefined) delete process.env[name]; else process.env[name] = originalKeys[index]; });
  }
});

test('legacy AI callable names preserve envelopes, enforce subscription and route text through the orchestrator', async () => {
  const uid = 'legacy-ai-test';
  const ref = db.doc(`users/${uid}/profile/data`);
  const endpoints = [generateWorkoutPlanAI, generateNutritionPlanAI, generateBoxingPlanAI, chatAI];
  const priorFetch = globalThis.fetch, priorKey = process.env.OPENAI_API_KEY;
  let calls = 0;
  try {
    process.env.OPENAI_API_KEY = 'emulator-fake-openai';
    globalThis.fetch = async url => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions'); calls++;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }));
    };
    await ref.set({ subscriptionStatus: 'vip', baseGym: 'Smart Fit', availableEquipment: ['Máquinas'] });
    for (const endpoint of endpoints) {
      assert.deepEqual(await endpoint.run({ auth: { uid, token: {} }, data: { prompt: 'test' } }), { text: '{}' });
      await assert.rejects(endpoint.run({ data: { prompt: 'test' } }), error => error.code === 'unauthenticated');
      await assert.rejects(endpoint.run({ auth: { uid }, data: null }), error => error.code === 'invalid-argument');
    }
    await ref.set({ subscriptionStatus: 'trialing', trialEndsAt: '2020-01-01' });
    for (const endpoint of endpoints) await assert.rejects(endpoint.run({ auth: { uid }, data: { prompt: 'test' } }), error => error.code === 'permission-denied');
    for (const endpoint of [analyzeInbodyAI, analyzeNutritionLabelAI]) {
      await assert.rejects(endpoint.run({ auth: { uid }, data: { prompt: 'test' } }), error => error.code === 'invalid-argument');
    }
    assert.equal(calls, 4);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey;
  }
});

test('server profile controls bodyweight catalog, rejects foreign exercises then falls back without losing images', async () => {
  const uid = 'bodyweight-ai-test';
  const ref = db.doc(`users/${uid}/profile/data`);
  await ref.set({ subscriptionStatus: 'vip', availableEquipment: ['BODYWEIGHT'] });
  await db.doc('global_exercises/emulator-bodyweight').set({ name: 'Floor Push-Up', muscleGroup: 'Pecho', equipment: 'body only', imageUrl: 'https://example.com/pushup.jpg' });
  await db.doc('global_exercises/emulator-barbell').set({ name: 'Barbell Press', muscleGroup: 'Pecho', equipment: 'barbell' });
  const names = ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY'];
  const previous = names.map(name => process.env[name]), originalFetch = globalThis.fetch;
  const workout = { nombre: 'Casa', nivelDificultad: 'intermedio', ejercicios: [{ id: 'emulator-bodyweight', nombre: 'Floor Push-Up', pesokg: 20 }] };
  let calls = 0;
  try {
    names.forEach(name => { process.env[name] = 'emulator-fake-key'; });
    globalThis.fetch = async (_url, request) => {
      calls++;
      const messages = JSON.parse(request.body).messages;
      assert.ok(messages[0].content.includes('BODYWEIGHT'));
      assert.ok(messages[0].content.includes('Floor Push-Up'));
      assert.equal(messages[0].content.includes('Barbell Press'), false);
      const generated = calls % 2 ? { ejercicios: [{ id: 'emulator-barbell', nombre: 'Barbell Press' }] } : workout;
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(generated) } }] }));
    };
    for (const endpoint of [callGemini, generateWorkoutPlanAI]) {
      const result = await endpoint.run({ auth: { uid }, data: {
        prompt: 'Usa barra pesada', model: 'gemini-2.5-flash', isJson: true, purpose: 'workout',
      } });
      const exercise = JSON.parse(result.text).ejercicios[0];
      assert.equal(exercise.id, 'emulator-bodyweight'); assert.equal(exercise.pesokg, 0);
      assert.equal(exercise.imageUrl, 'https://example.com/pushup.jpg');
      assert.deepEqual(exercise.equipmentRequired, ['BODYWEIGHT']);
    }
    assert.equal(calls, 4);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});
