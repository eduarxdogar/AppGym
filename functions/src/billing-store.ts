import { Firestore } from 'firebase-admin/firestore';
import { BillingProfile, initialTrial, isLifetimeVip, PaymentRecord, paymentProfileUpdate } from './billing';

/** Registration time comes from Firebase Auth, never from the client or a new login. */
export async function initializeBilling(db: Firestore, uid: string, registeredAt: number,
  identity: { email?: unknown; email_verified?: unknown; vip?: unknown }): Promise<void> {
  if (!Number.isFinite(registeredAt)) throw new Error('Invalid Auth registration date');
  const profileRef = db.doc(`users/${uid}/profile/data`);
  const accountRef = db.doc(`billing_accounts/${uid}`);
  const registrationTrial = initialTrial(registeredAt);
  await db.runTransaction(async transaction => {
    const [profile, account] = await Promise.all([transaction.get(profileRef), transaction.get(accountRef)]);
    const current = profile.data() as BillingProfile | undefined;
    if (current?.isDeleted) throw new Error('Deleted billing profile');
    const recordedEnd = account.get('trialEndsAt') as string | undefined;
    const legacyEnd = current?.subscriptionStatus === 'trialing' ? current.trialEndsAt : null;
    const ends = [registrationTrial.trialEndsAt, recordedEnd, legacyEnd]
      .filter((end): end is string => typeof end === 'string' && Number.isFinite(Date.parse(end)));
    const trialEndsAt = new Date(Math.min(...ends.map(end => Date.parse(end)))).toISOString();
    if (!account.exists) transaction.create(accountRef, {
      initializedAt: new Date().toISOString(), trialEndsAt,
    });
    if (isLifetimeVip(identity)) {
      if (current?.subscriptionStatus !== 'vip' || current.expiresAt !== null || current.trialEndsAt !== null) {
        transaction.set(profileRef, { subscriptionStatus: 'vip', trialEndsAt: null, expiresAt: null }, { merge: true });
      }
    } else if (!current?.subscriptionStatus || current.subscriptionStatus === 'trialing') {
      // Keep the earliest deadline; deleting a profile or logging in again cannot restart it.
      if (current?.subscriptionStatus !== 'trialing' || current.trialEndsAt !== trialEndsAt) {
        transaction.set(profileRef, { subscriptionStatus: 'trialing', trialEndsAt }, { merge: true });
      }
    }
  });
}

export async function applyPayment(db: Firestore, payment: PaymentRecord): Promise<void> {
  // Validate identity before interpolating provider data into a document path.
  paymentProfileUpdate(payment, {});
  const ref = db.doc(`users/${payment.external_reference}/profile/data`);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('Payment profile does not exist');
    const update = paymentProfileUpdate(payment, snapshot.data() ?? {});
    if (update) transaction.set(ref, update, { merge: true });
  });
}
