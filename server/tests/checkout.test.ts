import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store/memoryStore.js';

const app = createApp();
const validToken = 'qc_agent_test_tok_123';

describe('Checkout & Idempotency Rules', () => {
  beforeEach(() => {
    store.reset();
  });

  test('Checkout without location returns 422 LOCATION_NOT_SET', async () => {
    const sessionId = 'session_no_loc';

    // Add item first
    await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ productId: 'prod_fv_02', quantity: 2 })
      .expect(200);

    const res = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'key_no_loc')
      .send({ paymentMethod: 'razorpay' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LOCATION_NOT_SET');
  });

  test('Checkout with empty cart returns 422 CART_EMPTY', async () => {
    const sessionId = 'session_empty_cart';

    // Set location
    await request(app)
      .post('/v1/location')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ pincode: '302001' })
      .expect(200);

    const res = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'key_empty_cart')
      .send({ paymentMethod: 'razorpay' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  test('Checkout with wrong expectedTotalPaise returns 409 PRICE_MISMATCH', async () => {
    const sessionId = 'session_price_mismatch';

    // Set location (deliveryFee = 2900)
    await request(app)
      .post('/v1/location')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ pincode: '302001' })
      .expect(200);

    // Add 1 kg Tomatoes (price: 3800)
    await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ productId: 'prod_fv_02', quantity: 1 })
      .expect(200);

    // Wrong total expected: 99999
    const res = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'key_mismatch')
      .send({
        expectedTotalPaise: 99999,
        paymentMethod: 'razorpay',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRICE_MISMATCH');
    expect(res.body.error.details.expectedTotalPaise).toBe(99999);
    expect(res.body.error.details.actualTotalPaise).toBeDefined();
  });

  test('Idempotency: same key + same payload returns 200 and same order', async () => {
    const sessionId = 'session_idem_success';

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
      .send({ productId: 'prod_fv_02', quantity: 1 })
      .expect(200);

    const idempotencyKey = 'unique_idem_key_123';
    const payload = { paymentMethod: 'razorpay' };

    // First checkout -> 201 Created
    const res1 = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.orderId).toBeDefined();
    expect(res1.body.status).toBe('PENDING_PAYMENT');
    expect(res1.body.paymentSessionToken).toBeDefined();

    // Second checkout with same key and payload -> 200 OK with identical orderId
    const res2 = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.orderId).toBe(res1.body.orderId);
    expect(res2.body.paymentSessionToken).toBe(res1.body.paymentSessionToken);
  });

  test('Idempotency: same key + different payload returns 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const sessionId = 'session_idem_fail';

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
      .send({ productId: 'prod_fv_02', quantity: 1 })
      .expect(200);

    const idempotencyKey = 'reused_idem_key_456';

    // 1st request
    await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', idempotencyKey)
      .send({ paymentMethod: 'razorpay' })
      .expect(201);

    // 2nd request with different expected total
    const res2 = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', idempotencyKey)
      .send({ expectedTotalPaise: 7390, paymentMethod: 'razorpay' });

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});

