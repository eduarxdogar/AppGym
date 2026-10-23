import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentRecord } from './billing';

export interface PaymentNotification {
  method: string;
  signature: unknown;
  requestId: unknown;
  dataId: unknown;
  bodyDataId?: unknown;
  type: unknown;
}

/** Mercado Pago manifest: id:<lowercase id>;request-id:<id>;ts:<timestamp>; */
export function validPaymentSignature(input: PaymentNotification, secret: string, now = Date.now()): boolean {
  if (!secret || typeof input.signature !== 'string' || typeof input.requestId !== 'string'
    || typeof input.dataId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(input.dataId)
    || !input.requestId || /[;\r\n]/.test(input.requestId)) return false;
  const fields = input.signature.split(',').map(part => part.trim().split('='));
  const timestamps = fields.filter(([key]) => key === 'ts');
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (timestamps.length !== 1 || !/^\d{10,13}$/.test(timestamps[0][1] ?? '')) return false;
  const ts = timestamps[0][1];
  const timestampMs = Number(ts) * (ts.length === 13 ? 1 : 1000);
  if (Math.abs(now - timestampMs) > 300_000) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  return signatures.some(value => /^[a-fA-F0-9]{64}$/.test(value ?? '')
    && timingSafeEqual(expected, Buffer.from(value, 'hex')));
}

export async function processPaymentNotification(input: PaymentNotification, deps: {
  secret: string;
  now?: number;
  getPayment: (id: string) => Promise<PaymentRecord>;
  savePayment: (payment: PaymentRecord) => Promise<void>;
}): Promise<number> {
  if (input.method !== 'POST') return 405;
  if (!deps.secret) return 503;
  if (!validPaymentSignature(input, deps.secret, deps.now)) return 401;
  if (input.bodyDataId !== undefined && String(input.bodyDataId) !== input.dataId) return 400;
  if (input.type !== 'payment') return 200;
  if (!/^\d+$/.test(input.dataId as string)) return 400;
  // Only the API response can grant or revoke access. Errors must trigger redelivery.
  const payment = await deps.getPayment(input.dataId as string);
  if (String(payment.id) !== input.dataId) throw new Error('Payment identity mismatch');
  await deps.savePayment(payment);
  return 200;
}
