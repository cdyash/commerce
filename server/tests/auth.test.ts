import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store/memoryStore.js';
import { config } from '../src/config.js';

const app = createApp();

describe('Auth & Scope Verification', () => {
  beforeEach(() => {
    store.reset();
  });

  test('Missing Authorization header returns 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/v1/cart');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('Invalid bearer token returns 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/v1/cart')
      .set('Authorization', 'Bearer invalid_random_token_123');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('Readonly agent missing cart:write receives 403 INSUFFICIENT_SCOPE', async () => {
    // readonly_agent token: qc_ro_tok_456 has scopes: ['catalog:read', 'orders:read']
    const res = await request(app)
      .put('/v1/cart/items')
      .set('Authorization', 'Bearer qc_ro_tok_456')
      .send({ productId: 'prod_fv_01', quantity: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_SCOPE');
    expect(res.body.error.details.requiredScope).toBe('cart:write');
    expect(res.body.error.details.grantedScopes).toContain('catalog:read');
  });

  test('Admin endpoint without valid x-admin-key returns 401 UNAUTHORIZED_ADMIN', async () => {
    const res = await request(app).get('/admin/state');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED_ADMIN');
  });

  test('Admin endpoint with correct x-admin-key succeeds', async () => {
    const res = await request(app)
      .get('/admin/state')
      .set('x-admin-key', config.ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.body.counts).toBeDefined();
    expect(res.body.specVersion).toBe('v1');
  });

  test('Admin read endpoints (orders, catalog, webhook-events) succeed with x-admin-key', async () => {
    // 1. GET /admin/catalog
    const catRes = await request(app)
      .get('/admin/catalog')
      .set('x-admin-key', config.ADMIN_KEY);

    expect(catRes.status).toBe(200);
    expect(catRes.body.items).toBeDefined();
    expect(catRes.body.items.length).toBe(36);
    expect(catRes.body.total).toBe(36);

    // 2. GET /admin/orders
    const ordersRes = await request(app)
      .get('/admin/orders')
      .set('x-admin-key', config.ADMIN_KEY);

    expect(ordersRes.status).toBe(200);
    expect(ordersRes.body.orders).toBeDefined();
    expect(Array.isArray(ordersRes.body.orders)).toBe(true);

    // 3. GET /admin/webhook-events
    const eventsRes = await request(app)
      .get('/admin/webhook-events')
      .set('x-admin-key', config.ADMIN_KEY);

    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.events).toBeDefined();
    expect(Array.isArray(eventsRes.body.events)).toBe(true);
  });
});

