import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store/memoryStore.js';
import { config } from '../src/config.js';

const app = createApp();
const validToken = 'qc_agent_test_tok_123';

describe('OpenAPI Spec Versioning & Runtime Validation Switching', () => {
  beforeEach(() => {
    store.reset();
  });

  test('Spec v1 lacks getOrder; v2 adds getOrder', async () => {
    // 1. In v1, /openapi.json lacks /v1/orders/{orderId}
    const specResV1 = await request(app).get('/openapi.json').expect(200);
    expect(specResV1.body.info.version).toBe('v1');
    expect(specResV1.body.paths['/v1/orders/{orderId}']).toBeUndefined();

    // In v1, calling getOrder returns 404
    const getOrderResV1 = await request(app)
      .get('/v1/orders/ord_test_dummy')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(404);
    expect(getOrderResV1.body.error.code).toBe('NOT_FOUND');

    // 2. Switch to v2
    await request(app)
      .post('/admin/spec-version')
      .set('x-admin-key', config.ADMIN_KEY)
      .send({ version: 'v2' })
      .expect(200);

    const specResV2 = await request(app).get('/openapi.json').expect(200);
    expect(specResV2.body.info.version).toBe('v2');
    expect(specResV2.body.paths['/v1/orders/{orderId}']).toBeDefined();
    expect(specResV2.body.paths['/v1/orders/{orderId}'].get.operationId).toBe('getOrder');

    // ETag changes
    expect(specResV2.headers.etag).not.toBe(specResV1.headers.etag);
  });

  test('Spec v3 makes deliverySlot required; v1 payload fails with 400 VALIDATION_ERROR', async () => {
    const sessionId = 'session_v3_validation';

    // Switch to v3
    await request(app)
      .post('/admin/spec-version')
      .set('x-admin-key', config.ADMIN_KEY)
      .send({ version: 'v3' })
      .expect(200);

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

    // v1 shaped checkout (missing deliverySlot) fails with 400
    const failRes = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'idem_v3_test_1')
      .send({ paymentMethod: 'razorpay' });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(failRes.body.error.details.issues.some((i: { path: string }) => i.path === 'deliverySlot')).toBe(true);

    // With deliverySlot provided, checkout succeeds
    const successRes = await request(app)
      .post('/v1/checkout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .set('Idempotency-Key', 'idem_v3_test_2')
      .send({ paymentMethod: 'razorpay', deliverySlot: 'asap' });

    expect(successRes.status).toBe(201);
    expect(successRes.body.orderId).toBeDefined();
  });

  test('Spec v4 replaces applyPromo with applyCoupon at POST /v1/cart/coupons', async () => {
    const sessionId = 'session_v4_coupons';

    // 1. Switch to v4
    await request(app)
      .post('/admin/spec-version')
      .set('x-admin-key', config.ADMIN_KEY)
      .send({ version: 'v4' })
      .expect(200);

    const specRes = await request(app).get('/openapi.json').expect(200);
    expect(specRes.body.info.version).toBe('v4');
    expect(specRes.body.paths['/v1/cart/promo']).toBeUndefined();
    expect(specRes.body.paths['/v1/cart/coupons']).toBeDefined();
    expect(specRes.body.paths['/v1/cart/coupons'].post.operationId).toBe('applyCoupon');

    // 2. Add item to cart
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
      .send({ productId: 'prod_fv_01', quantity: 1 })
      .expect(200);

    // 3. Old POST /v1/cart/promo fails in v4 with 404
    const oldPromoRes = await request(app)
      .post('/v1/cart/promo')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ code: 'WELCOME10' });

    expect(oldPromoRes.status).toBe(404);
    expect(oldPromoRes.body.error.code).toBe('ENDPOINT_DEPRECATED');

    // 4. New POST /v1/cart/coupons succeeds with couponCode
    const couponRes = await request(app)
      .post('/v1/cart/coupons')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({ couponCode: 'WELCOME10' });

    expect(couponRes.status).toBe(200);
    expect(couponRes.body.appliedPromos).toContain('WELCOME10');
  });
});

