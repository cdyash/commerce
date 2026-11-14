import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store/memoryStore.js';

const app = createApp();
const validToken = 'qc_agent_test_tok_123';

describe('Cart Endpoints & Business Constraints', () => {
  beforeEach(() => {
    store.reset();
  });

  test('Adding item exceeding maxPerOrder returns 422 QUANTITY_EXCEEDS_LIMIT', async () => {
    // prod_fv_01 has maxPerOrder: 4
    const res = await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', 'test_cart_max')
      .send({
        productId: 'prod_fv_01',
        quantity: 10,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('QUANTITY_EXCEEDS_LIMIT');
    expect(res.body.error.details.maxPerOrder).toBe(4);
  });

  test('Adding an out of stock product returns 422 OUT_OF_STOCK', async () => {
    // prod_fv_06 has stock 0 (Tender Coconut)
    const res = await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', 'test_cart_oos')
      .send({
        productId: 'prod_fv_06',
        quantity: 1,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
  });

  test('Updating item quantity to 0 removes line item', async () => {
    const sessionId = 'test_cart_remove';

    // 1. Add 2 mangoes
    await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({
        productId: 'prod_fv_01',
        quantity: 2,
      })
      .expect(200);

    // Verify in cart
    const cartRes1 = await request(app)
      .get('/v1/cart')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .expect(200);

    expect(cartRes1.body.items).toHaveLength(1);
    expect(cartRes1.body.items[0].quantity).toBe(2);

    // 2. Set quantity to 0
    const cartRes2 = await request(app)
      .put('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-session-id', sessionId)
      .send({
        productId: 'prod_fv_01',
        quantity: 0,
      })
      .expect(200);

    expect(cartRes2.body.items).toHaveLength(0);
    expect(cartRes2.body.breakdown.totalPaise).toBe(0);
  });
});

