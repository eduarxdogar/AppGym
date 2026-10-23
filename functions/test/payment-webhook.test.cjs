const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { validPaymentSignature, processPaymentNotification } = require('../lib/payment-webhook');
const { paymentProfileUpdate, initialTrial, hasSubscriptionAccess, isLifetimeVip } = require('../lib/billing');
const now = Date.parse('2026-10-19T12:00:00Z');
const secret = 'unit-test-webhook-secret';
function notification(overrides = {}) {
  const input = { method: 'POST', requestId: 'request-123', dataId: '12345', bodyDataId: 12345,
    type: 'payment', ...overrides };
  const ts = String(now / 1000);
  input.signature = `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${String(input.dataId).toLowerCase()};request-id:${input.requestId};ts:${ts};`).digest('hex')}`;
  return input;
}
const approved = { id: 12345, external_reference: 'alice', status: 'approved', transaction_amount: 30000,
  currency_id: 'COP', date_approved: '2026-10-19T10:00:00Z', date_last_updated: '2026-10-19T10:01:00Z' };

test('valid signature binds query id, request id and timestamp; rejects tampering and stale signatures', () => {
  const input = notification();
  assert.equal(validPaymentSignature(input, secret, now), true);
  for (const override of [{ dataId: '54321' }, { requestId: 'other' }, { signature: 'ts=1,v1=bad' },
    { dataId: ['12345'] }, { signature: undefined }]) {
    assert.equal(validPaymentSignature({ ...input, ...override }, secret, now), false);
  }
  assert.equal(validPaymentSignature(input, 'wrong-secret', now), false);
  assert.equal(validPaymentSignature(input, secret, now + 300001), false);
  assert.equal(validPaymentSignature(input, secret, now - 300001), false);
  const ts = String(now);
  const digest = createHmac('sha256', secret).update(`id:12345;request-id:request-123;ts:${ts};`).digest('hex');
  assert.equal(validPaymentSignature({ ...input, signature: `ts=${ts},v1=${digest}` }, secret, now), true);
});
test('unsigned, mismatched or unconfigured webhook never calls provider or storage', async () => {
  let calls = 0;
  const deps = { secret, now, getPayment: async () => { calls++; return approved; }, savePayment: async () => { calls++; } };
  assert.equal(await processPaymentNotification({ ...notification(), signature: '' }, deps), 401);
  assert.equal(await processPaymentNotification(notification({ bodyDataId: 222 }), deps), 400);
  assert.equal(await processPaymentNotification(notification({ method: 'GET' }), deps), 405);
  assert.equal(await processPaymentNotification(notification(), { ...deps, secret: '' }), 503);
  assert.equal(calls, 0);
});
test('handler uses API payment, not notification body; errors propagate so HTTP adapter retries', async () => {
  let stored;
  const deps = { secret, now, getPayment: async id => { assert.equal(id, '12345'); return approved; },
    savePayment: async value => { stored = value; } };
  assert.equal(await processPaymentNotification(notification(), deps), 200);
  assert.equal(stored, approved);
  await assert.rejects(processPaymentNotification(notification(), { ...deps, getPayment: async () => { throw new Error('timeout'); } }));
  await assert.rejects(processPaymentNotification(notification(), { ...deps, savePayment: async () => { throw new Error('Firestore unavailable'); } }));
  await assert.rejects(processPaymentNotification(notification(), { ...deps, getPayment: async () => ({ ...approved, id: 999 }) }));
});
test('approved expires exactly 30 days after approval; duplicates never extend or rewrite', () => {
  const update = paymentProfileUpdate(approved, {});
  assert.equal(update.subscriptionStatus, 'active');
  assert.equal(update.expiresAt, '2026-11-18T10:00:00.000Z');
  assert.equal(update.trialEndsAt, null);
  assert.equal(paymentProfileUpdate(approved, update), null);
  assert.equal(hasSubscriptionAccess(update, Date.parse(update.expiresAt)), false);
});
for (const status of ['cancelled', 'refunded', 'charged_back']) {
  test(`${status} revokes current payment; stale approval cannot restore access`, () => {
    const active = paymentProfileUpdate(approved, {});
    const update = paymentProfileUpdate({ ...approved, status, date_last_updated: '2026-10-20T00:00:00Z' }, active);
    assert.notEqual(update.subscriptionStatus, 'active');
    assert.equal(hasSubscriptionAccess(update, now), false);
    assert.equal(paymentProfileUpdate(approved, update), null);
    assert.equal(paymentProfileUpdate({ ...approved, date_last_updated: '2026-10-21T00:00:00Z' }, update), null);
  });
}
test('an old refund or delayed older approval cannot override a newer paid period', () => {
  const latest = paymentProfileUpdate({ ...approved, id: 23456, date_approved: '2026-10-21T00:00:00Z', date_last_updated: '2026-10-21T00:00:00Z' }, {});
  assert.equal(paymentProfileUpdate({ ...approved, status: 'refunded', date_last_updated: '2026-10-22T00:00:00Z' }, latest), null);
  assert.equal(paymentProfileUpdate(approved, latest), null);
});
test('partial refund revokes access and unapproved statuses do not grant it', () => {
  assert.equal(paymentProfileUpdate({ ...approved, transaction_amount_refunded: 1 }, {}).subscriptionStatus, 'refunded');
  for (const status of ['pending', 'in_process', 'rejected']) assert.equal(paymentProfileUpdate({ ...approved, status }, {}), null);
});
test('wrong price/currency, path injection and missing provider dates are rejected', () => {
  for (const override of [{ transaction_amount: 1 }, { currency_id: 'USD' }, { external_reference: 'alice/profile/data' },
    { date_approved: undefined }, { date_last_updated: undefined }]) {
    assert.throws(() => paymentProfileUpdate({ ...approved, ...override }, {}));
  }
});
test('trial lasts seven days; expired or dateless paid profiles do not have access', () => {
  const trial = initialTrial(now);
  assert.equal(Date.parse(trial.trialEndsAt) - now, 7 * 86400000);
  assert.equal(hasSubscriptionAccess(trial, now), true);
  assert.equal(hasSubscriptionAccess(trial, now + 7 * 86400000), false);
  assert.equal(hasSubscriptionAccess({ subscriptionStatus: 'active' }, now), false);
});

test('lifetime VIP requires a verified administrator identity and survives payment notifications', () => {
  assert.equal(isLifetimeVip({ email: 'cristiangarzon1231@gmail.com', email_verified: true }), true);
  for (const identity of [{}, { email: 'cristiangarzon1231@gmail.com', email_verified: false },
    { email: 'other@example.com', email_verified: true }]) assert.equal(isLifetimeVip(identity), false);
  const vip = { subscriptionStatus: 'vip', trialEndsAt: null, expiresAt: null };
  assert.equal(hasSubscriptionAccess(vip, now + 100 * 365 * 86400000), true);
  assert.equal(hasSubscriptionAccess({ ...vip, isDeleted: true }, now), false);
  assert.equal(paymentProfileUpdate(approved, vip), null);
  assert.equal(paymentProfileUpdate({ ...approved, status: 'refunded' }, vip), null);
});

test('a server-issued boolean VIP claim grants lifetime access independently of the email', () => {
  assert.equal(isLifetimeVip({ email: 'julli1230@gmail.com', vip: true }), true);
  assert.equal(isLifetimeVip({ email: 'julli1230@gmail.com', vip: 'true' }), false);
  assert.equal(isLifetimeVip({ email: 'julli1230@gmail.com', admin: true }), false);
});
