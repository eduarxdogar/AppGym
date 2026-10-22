"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONTHLY_CURRENCY = exports.MONTHLY_PRICE = void 0;
exports.isLifetimeVip = isLifetimeVip;
exports.hasSubscriptionAccess = hasSubscriptionAccess;
exports.initialTrial = initialTrial;
exports.paymentProfileUpdate = paymentProfileUpdate;
exports.MONTHLY_PRICE = 30000;
exports.MONTHLY_CURRENCY = 'COP';
const DAY = 24 * 60 * 60 * 1000;
const LIFETIME_VIP_EMAIL = 'cristiangarzon1231@gmail.com';
function isLifetimeVip(identity) {
    return identity.vip === true || (identity.email_verified === true && identity.email === LIFETIME_VIP_EMAIL);
}
function hasSubscriptionAccess(profile, now = Date.now()) {
    if (profile.isDeleted)
        return false;
    if (profile.subscriptionStatus === 'vip')
        return true;
    const end = profile.subscriptionStatus === 'active' ? profile.expiresAt
        : profile.subscriptionStatus === 'trialing' ? profile.trialEndsAt : null;
    return !!end && Date.parse(end) > now;
}
function initialTrial(registeredAt = Date.now()) {
    return { subscriptionStatus: 'trialing', trialEndsAt: new Date(registeredAt + 7 * DAY).toISOString() };
}
/** Uses provider dates, never delivery time: redelivery cannot extend access. */
function paymentProfileUpdate(payment, current) {
    const id = String(payment.id ?? '');
    const uid = payment.external_reference;
    if (!/^\d+$/.test(id) || !uid || uid.includes('/') || uid.length > 128) {
        throw new Error('Invalid payment identity');
    }
    const revoked = ['cancelled', 'canceled', 'refunded', 'charged_back'].includes(payment.status ?? '');
    if (payment.status !== 'approved' && !revoked)
        return null;
    if (payment.transaction_amount !== exports.MONTHLY_PRICE || payment.currency_id !== exports.MONTHLY_CURRENCY) {
        throw new Error('Unexpected payment amount or currency');
    }
    // An old payment or refund must never replace the administrator's lifetime grant.
    if (current.subscriptionStatus === 'vip')
        return null;
    const updated = Date.parse(payment.date_last_updated ?? '');
    const approved = Date.parse(payment.date_approved ?? '');
    if (!Number.isFinite(updated))
        throw new Error('Missing provider update date');
    const samePayment = current.subscriptionPaymentId === id;
    if (samePayment && updated <= Date.parse(current.subscriptionPaymentUpdatedAt ?? ''))
        return null;
    if (samePayment && ['canceled', 'refunded', 'charged_back'].includes(current.subscriptionStatus ?? '')
        && payment.status === 'approved')
        return null;
    // A refund for an old payment must not cancel a newer paid period.
    if (revoked && current.subscriptionPaymentId && !samePayment)
        return null;
    if (payment.status === 'approved' && !Number.isFinite(approved))
        throw new Error('Missing approval date');
    if (!samePayment && approved <= Date.parse(current.subscriptionPaymentApprovedAt ?? ''))
        return null;
    const refunded = (payment.transaction_amount_refunded ?? 0) > 0;
    const active = payment.status === 'approved' && !refunded;
    return {
        subscriptionStatus: active ? 'active' : refunded || payment.status === 'refunded' ? 'refunded'
            : payment.status === 'charged_back' ? 'charged_back' : 'canceled',
        expiresAt: new Date(active ? approved + 30 * DAY : updated).toISOString(),
        trialEndsAt: null,
        subscriptionPaymentId: id,
        subscriptionPaymentUpdatedAt: new Date(updated).toISOString(),
        ...(Number.isFinite(approved) ? { subscriptionPaymentApprovedAt: new Date(approved).toISOString() } : {}),
    };
}
//# sourceMappingURL=billing.js.map