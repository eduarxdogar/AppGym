"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validPaymentSignature = validPaymentSignature;
exports.processPaymentNotification = processPaymentNotification;
const node_crypto_1 = require("node:crypto");
/** Mercado Pago manifest: id:<lowercase id>;request-id:<id>;ts:<timestamp>; */
function validPaymentSignature(input, secret, now = Date.now()) {
    if (!secret || typeof input.signature !== 'string' || typeof input.requestId !== 'string'
        || typeof input.dataId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(input.dataId)
        || !input.requestId || /[;\r\n]/.test(input.requestId))
        return false;
    const fields = input.signature.split(',').map(part => part.trim().split('='));
    const timestamps = fields.filter(([key]) => key === 'ts');
    const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
    if (timestamps.length !== 1 || !/^\d{10,13}$/.test(timestamps[0][1] ?? ''))
        return false;
    const ts = timestamps[0][1];
    const timestampMs = Number(ts) * (ts.length === 13 ? 1 : 1000);
    if (Math.abs(now - timestampMs) > 300_000)
        return false;
    const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${ts};`;
    const expected = (0, node_crypto_1.createHmac)('sha256', secret).update(manifest).digest();
    return signatures.some(value => /^[a-fA-F0-9]{64}$/.test(value ?? '')
        && (0, node_crypto_1.timingSafeEqual)(expected, Buffer.from(value, 'hex')));
}
async function processPaymentNotification(input, deps) {
    if (input.method !== 'POST')
        return 405;
    if (!deps.secret)
        return 503;
    if (!validPaymentSignature(input, deps.secret, deps.now))
        return 401;
    if (input.bodyDataId !== undefined && String(input.bodyDataId) !== input.dataId)
        return 400;
    if (input.type !== 'payment')
        return 200;
    if (!/^\d+$/.test(input.dataId))
        return 400;
    // Only the API response can grant or revoke access. Errors must trigger redelivery.
    const payment = await deps.getPayment(input.dataId);
    if (String(payment.id) !== input.dataId)
        throw new Error('Payment identity mismatch');
    await deps.savePayment(payment);
    return 200;
}
//# sourceMappingURL=payment-webhook.js.map