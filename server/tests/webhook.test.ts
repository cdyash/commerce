import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { store } from '../src/store/memoryStore.js';
import { config } from '../src/config.js';

const app = createApp();
const validToken = 'qc_agent_test_tok_123';

function signPayload(payloadString: string, secret: string = config.RAZORPAY_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(Buffer.from(payloadString, 'utf8')).digest('hex');
}

describe('Razorpay Webhook Handling & Cryptographic Verification', () => {
  beforeEach(() => {
    store.reset();
  });

  test('Valid webhook signature transitions order to PAID, decrements stock, and clears cart', async () => {
    const sessionId = 'session_webhook_paid';

    // 1. Setup cart & location
    await request(app)
      .post('/v1/location')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ pincode: '302001' })
      .expect(200);

    const initialStock = store.products.get('prod_fv_02')!.stock;

    await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ productId: 'prod_fv_02', quantity: 2 })
      .expect(200);

    // 2. Checkout
    const checkoutRes = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'idem_webhook_test_1')
      .send({ paymentMethod: 'razorpay' })
      .expect(201);

    const orderId = checkoutRes.body.orderId;

    // 3. Craft signed Razorpay payment.captured webhook payload
    const webhookPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_test',
      event: 'payment.captured',
      id: 'evt_test_captured_01',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_test_123',
            order_id: checkoutRes.body.razorpayOrderId,
            status: 'captured',
            notes: { orderId },
          },
        },
      },
    });

    const signature = signPayload(webhookPayload);

    // 4. Send webhook
    const webhookRes = await request(app)
      .post('/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_test_captured_01')
      .set('Content-Type', 'application/json')
      .send(webhookPayload);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.status).toBe('processed');

    // Verify order state is PAID
    const order = store.orders.get(orderId);
    expect(order).toBeDefined();
    expect(order!.status).toBe('PAID');
    expect(order!.paymentStatus).toBe('captured');

    // Verify stock was decremented
    const updatedStock = store.products.get('prod_fv_02')!.stock;
    expect(updatedStock).toBe(initialStock - 2);

    // Verify session cart was cleared
    const cartRes = await request(app)
      .get('/v1/cart')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .expect(200);

    expect(cartRes.body.items).toHaveLength(0);
  });

  test('Invalid webhook signature is rejected with 400 INVALID_SIGNATURE', async () => {
    const payload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      id: 'evt_tampered',
      payload: {},
    });

    const badSignature = 'invalid_tampered_hmac_signature_0000000000000000000000000000000000000000000000000000000000000000';

    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('x-razorpay-signature', badSignature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  test('Duplicate webhook event is ignored with 200', async () => {
    const payload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      id: 'evt_duplicate_test',
      payload: {},
    });

    const signature = signPayload(payload);

    // First delivery
    const res1 = await request(app)
      .post('/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_duplicate_test')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res1.status).toBe(200);

    // Second delivery (duplicate)
    const res2 = await request(app)
      .post('/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_duplicate_test')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('ignored');
  });

  test('payment.failed preserves cart and invalidates paymentSessionToken', async () => {
    const sessionId = 'session_payment_failed';

    await request(app)
      .post('/v1/location')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ pincode: '302001' })
      .expect(200);

    await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ productId: 'prod_fv_02', quantity: 2 })
      .expect(200);

    const checkoutRes = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'idem_fail_1')
      .send({ paymentMethod: 'razorpay' })
      .expect(201);

    const orderId = checkoutRes.body.orderId;
    const oldSessionToken = checkoutRes.body.paymentSessionToken;

    // Send payment.failed webhook
    const failPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.failed',
      id: 'evt_failed_01',
      payload: {
        payment: {
          entity: {
            id: 'pay_failed_123',
            notes: { orderId },
          },
        },
      },
    });

    const sig = signPayload(failPayload);

    await request(app)
      .post('/webhooks/razorpay')
      .set('x-razorpay-signature', sig)
      .set('x-razorpay-event-id', 'evt_failed_01')
      .set('Content-Type', 'application/json')
      .send(failPayload)
      .expect(200);

    const order = store.orders.get(orderId);
    expect(order!.status).toBe('PAYMENT_FAILED');
    expect(order!.paymentSessionTokenValid).toBe(false);

    // Cart is still intact
    const cartRes = await request(app)
      .get('/v1/cart')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .expect(200);

    expect(cartRes.body.items).toHaveLength(1);
    expect(cartRes.body.items[0].quantity).toBe(2);

    // Client can checkout again and gets a fresh valid token
    const retryCheckout = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'idem_fail_retry')
      .send({ paymentMethod: 'razorpay' })
      .expect(201);

    expect(retryCheckout.body.paymentSessionToken).not.toBe(oldSessionToken);

    // Verifying old token directly throws 409 if verified against invalidated state
    const orderAfter = store.orders.get(orderId);
    expect(orderAfter!.paymentSessionTokenValid).toBe(false);
  });
});
