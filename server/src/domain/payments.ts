import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';

export interface RazorpayOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface IRazorpayClient {
  createOrder(params: RazorpayOrderParams): Promise<{ id: string }>;
}

export class RealRazorpayClient implements IRazorpayClient {
  private rzp: Razorpay;

  constructor(key_id: string, key_secret: string) {
    this.rzp = new Razorpay({ key_id, key_secret });
  }

  async createOrder(params: RazorpayOrderParams): Promise<{ id: string }> {
    const res = await this.rzp.orders.create(params);
    return { id: res.id };
  }
}

export class FakeRazorpayClient implements IRazorpayClient {
  async createOrder(params: RazorpayOrderParams): Promise<{ id: string }> {
    const hash = crypto
      .createHash('sha256')
      .update(params.receipt || String(Date.now()))
      .digest('hex')
      .slice(0, 14);
    return { id: `order_fake_${hash}` };
  }
}

let customClient: IRazorpayClient | null = null;

export function setRazorpayClient(client: IRazorpayClient | null): void {
  customClient = client;
}

export function isPlaceholderKey(keyId: string): boolean {
  return (
    !keyId ||
    keyId.includes('test_merchant') ||
    keyId.includes('placeholder') ||
    keyId.startsWith('rzp_test_merchant')
  );
}

export function getRazorpayClient(): IRazorpayClient {
  if (customClient) {
    return customClient;
  }

  // Use fake client in test mode or whenever keys are placeholders
  const isTestEnv = process.env.NODE_ENV === 'test';
  const isPlaceholder = isPlaceholderKey(config.RAZORPAY_KEY_ID);

  if (isTestEnv || isPlaceholder) {
    return new FakeRazorpayClient();
  }

  return new RealRazorpayClient(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET);
}

export interface PaymentSessionPayload {
  orderId: string;
  amountPaise: number;
  expiresAt: string;
}

/**
 * Creates an HMAC-SHA256 signed payment session token.
 */
export function createPaymentSessionToken(
  orderId: string,
  amountPaise: number,
  expiresAt: string
): string {
  const payloadStr = JSON.stringify({ orderId, amountPaise, expiresAt });
  const payloadBase64 = Buffer.from(payloadStr, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.SESSION_SIGNING_SECRET)
    .update(payloadBase64)
    .digest('hex');

  return `pst_${payloadBase64}.${signature}`;
}

/**
 * Verifies a payment session token HMAC and expiration.
 */
export function verifyPaymentSessionToken(token: string): PaymentSessionPayload {
  if (!token || !token.startsWith('pst_')) {
    throw new AppError(409, 'PAYMENT_SESSION_INVALID', 'Malformed payment session token format.');
  }

  const parts = token.slice(4).split('.');
  if (parts.length !== 2) {
    throw new AppError(409, 'PAYMENT_SESSION_INVALID', 'Malformed payment session token structure.');
  }

  const [payloadBase64, providedSig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', config.SESSION_SIGNING_SECRET)
    .update(payloadBase64)
    .digest('hex');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    throw new AppError(409, 'PAYMENT_SESSION_INVALID', 'Invalid signature on payment session token.');
  }

  let payload: PaymentSessionPayload;
  try {
    const raw = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    payload = JSON.parse(raw);
  } catch {
    throw new AppError(409, 'PAYMENT_SESSION_INVALID', 'Unable to decode payment session token payload.');
  }

  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new AppError(409, 'PAYMENT_SESSION_INVALID', 'Payment session has expired. Please initiate checkout again.');
  }

  return payload;
}

/**
 * Creates a Razorpay Order in INR paise using the configured IRazorpayClient.
 * Fully offline-compatible and deterministic when test keys are used.
 */
export async function createRazorpayOrder(
  orderId: string,
  amountPaise: number
): Promise<string> {
  const client = getRazorpayClient();
  const order = await client.createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: orderId,
    notes: { orderId },
  });
  return order.id;
}

/**
 * Verifies Razorpay webhook HMAC-SHA256 signature against raw body Buffer.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader || !rawBody) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const receivedBuf = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
