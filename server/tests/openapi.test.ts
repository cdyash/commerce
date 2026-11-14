/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import { createApp } from '../src/app.js';
import { store, SpecVersion } from '../src/store/memoryStore.js';
import { config } from '../src/config.js';
import { buildOpenApiSpec } from '../src/openapi/openapiBuilder.js';

const app = createApp();
const validToken = 'qc_agent_test_tok_123';
const readonlyToken = 'qc_ro_tok_456'; // has catalog:read and orders:read, lacks cart:write and checkout:create

// --- OpenAPI Schema Dereference & Validation Helpers ---

function isNullable(schema: any): boolean {
  if (!schema) return false;
  if (schema.type === 'null') return true;
  if (Array.isArray(schema.type) && schema.type.includes('null')) return true;
  if (schema.nullable === true) return true;
  if (schema.allOf && schema.allOf.some(isNullable)) return true;
  if (schema.anyOf && schema.anyOf.some(isNullable)) return true;
  if (schema.oneOf && schema.oneOf.some(isNullable)) return true;
  return false;
}

function dereferenceSchema(schema: any, rootSpec: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref && typeof schema.$ref === 'string') {
    const parts = schema.$ref.replace(/^#\//, '').split('/');
    let resolved = rootSpec;
    for (const part of parts) {
      resolved = resolved?.[part];
    }
    if (!resolved) {
      throw new Error(`Unresolvable $ref: ${schema.$ref}`);
    }
    return dereferenceSchema(JSON.parse(JSON.stringify(resolved)), rootSpec);
  }
  if (Array.isArray(schema)) {
    return schema.map((item) => dereferenceSchema(item, rootSpec));
  }
  const result: any = {};
  for (const [key, val] of Object.entries(schema)) {
    result[key] = dereferenceSchema(val, rootSpec);
  }
  return result;
}

function validateSchema(data: any, schema: any, path = '$'): void {
  if (!schema) return;

  if (data === null) {
    if (isNullable(schema)) return;
    throw new Error(`Null value is not allowed at path: ${path}`);
  }

  // Handle allOf
  if (schema.allOf && Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      validateSchema(data, sub, path);
    }
    return;
  }

  // Handle anyOf / oneOf
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const matched = schema.anyOf.some((sub: any) => {
      try {
        validateSchema(data, sub, path);
        return true;
      } catch {
        return false;
      }
    });
    if (!matched) {
      throw new Error(`Data at ${path} did not match any of anyOf schemas.`);
    }
    return;
  }

  // Handle type
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType =
      Array.isArray(data)
        ? 'array'
        : typeof data === 'number'
        ? Number.isInteger(data)
          ? 'integer'
          : 'number'
        : typeof data;

    const matches = types.some((t: string) => {
      if (t === 'integer') return actualType === 'integer';
      if (t === 'number') return actualType === 'number' || actualType === 'integer';
      return actualType === t;
    });

    if (!matches) {
      throw new Error(`Expected ${path} to be of type ${JSON.stringify(schema.type)}, got ${actualType}`);
    }
  }

  // Handle enum
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      throw new Error(`Value ${JSON.stringify(data)} at ${path} is not in enum: ${JSON.stringify(schema.enum)}`);
    }
  }

  // Object checks: required fields and property recursion
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (schema.required && Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (data[reqKey] === undefined) {
          throw new Error(`Missing required property '${reqKey}' at path: ${path}`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (data[key] !== undefined) {
          validateSchema(data[key], propSchema, `${path}.${key}`);
        }
      }
    }
  }

  // Array checks
  if (Array.isArray(data) && schema.items) {
    data.forEach((item, idx) => {
      validateSchema(item, schema.items, `${path}[${idx}]`);
    });
  }
}

function validateResponseAgainstSpec(
  spec: any,
  routePath: string,
  method: string,
  statusCode: number,
  responseBody: any
) {
  const methodLower = method.toLowerCase();
  const pathItem = spec.paths?.[routePath];
  expect(pathItem).toBeDefined();

  const op = pathItem[methodLower];
  expect(op).toBeDefined();

  const responseDef = op.responses?.[String(statusCode)];
  expect(responseDef).toBeDefined();

  const schemaDef = responseDef.content?.['application/json']?.schema;
  expect(schemaDef).toBeDefined();

  const derefed = dereferenceSchema(schemaDef, spec);
  validateSchema(responseBody, derefed);
}

describe('OpenAPI 3.1 Spec Conformance', () => {
  beforeEach(async () => {
    store.reset();
  });

  // --- Rule 1: Error Response Enums & Examples ---
  test('Error responses across statuses have correct distinct error-code enums and examples', () => {
    const versions: SpecVersion[] = ['v1', 'v2', 'v3', 'v4'];

    for (const v of versions) {
      const spec = buildOpenApiSpec(v) as any;

      // 401 UNAUTHORIZED
      const res401 = spec.paths['/v1/cart'].get.responses['401'];
      expect(res401.content['application/json'].schema.properties.error.properties.code.enum).toEqual(['UNAUTHORIZED']);
      expect(res401.content['application/json'].schema.properties.error.properties.code.example).toBe('UNAUTHORIZED');

      // 403 INSUFFICIENT_SCOPE
      const res403 = spec.paths['/v1/cart'].get.responses['403'];
      expect(res403.content['application/json'].schema.properties.error.properties.code.enum).toEqual(['INSUFFICIENT_SCOPE']);
      expect(res403.content['application/json'].schema.properties.error.properties.code.example).toBe('INSUFFICIENT_SCOPE');

      // 404 PRODUCT_NOT_FOUND / PROMO_NOT_FOUND
      const res404 = spec.paths['/v1/cart/items'].put.responses['404'];
      const expected404Enums =
        v === 'v1'
          ? ['PRODUCT_NOT_FOUND', 'PROMO_NOT_FOUND']
          : ['PRODUCT_NOT_FOUND', 'PROMO_NOT_FOUND', 'ORDER_NOT_FOUND'];
      expect(res404.content['application/json'].schema.properties.error.properties.code.enum).toEqual(expected404Enums);
      expect(res404.content['application/json'].schema.properties.error.properties.code.example).toBe('PRODUCT_NOT_FOUND');

      // 409 PROMO_CONFLICT / PRICE_MISMATCH / IDEMPOTENCY_KEY_REUSED
      const res409 = spec.paths['/v1/checkout'].post.responses['409'];
      expect(res409.content['application/json'].schema.properties.error.properties.code.enum).toEqual([
        'PROMO_CONFLICT',
        'PRICE_MISMATCH',
        'IDEMPOTENCY_KEY_REUSED',
      ]);
      expect(res409.content['application/json'].schema.properties.error.properties.code.example).toBe('PRICE_MISMATCH');

      // 410 PROMO_EXPIRED
      if (v !== 'v4') {
        const res410 = spec.paths['/v1/cart/promo'].post.responses['410'];
        expect(res410.content['application/json'].schema.properties.error.properties.code.enum).toEqual(['PROMO_EXPIRED']);
        expect(res410.content['application/json'].schema.properties.error.properties.code.example).toBe('PROMO_EXPIRED');
      } else {
        const res410 = spec.paths['/v1/cart/coupons'].post.responses['410'];
        expect(res410.content['application/json'].schema.properties.error.properties.code.enum).toEqual(['PROMO_EXPIRED']);
        expect(res410.content['application/json'].schema.properties.error.properties.code.example).toBe('PROMO_EXPIRED');
      }

      // 422 LOCATION_UNSERVICEABLE / LOCATION_NOT_SET / CART_EMPTY / OUT_OF_STOCK / QUANTITY_EXCEEDS_LIMIT / PROMO_MIN_NOT_MET
      const res422 = spec.paths['/v1/location'].post.responses['422'];
      expect(res422.content['application/json'].schema.properties.error.properties.code.enum).toEqual([
        'LOCATION_UNSERVICEABLE',
        'LOCATION_NOT_SET',
        'CART_EMPTY',
        'OUT_OF_STOCK',
        'QUANTITY_EXCEEDS_LIMIT',
        'PROMO_MIN_NOT_MET',
      ]);
      expect(res422.content['application/json'].schema.properties.error.properties.code.example).toBe('LOCATION_UNSERVICEABLE');

      // 429 RATE_LIMITED with Retry-After response header
      const res429 = spec.paths['/v1/cart'].get.responses['429'];
      expect(res429.content['application/json'].schema.properties.error.properties.code.enum).toEqual(['RATE_LIMITED']);
      expect(res429.content['application/json'].schema.properties.error.properties.code.example).toBe('RATE_LIMITED');
      expect(res429.headers['Retry-After']).toBeDefined();
      expect(res429.headers['Retry-After'].schema.type).toBe('integer');
      expect(res429.headers['Retry-After'].schema.example).toBe(60);
    }
  });

  // --- Rule 2: Shared Component Registration & $ref Usage ---
  test('Components.schemas has Cart, CartItem, DeliveryLocation, PriceBreakdown, ErrorEnvelope, CheckoutResponse; x-session-id is in components.parameters and $refed', () => {
    const versions: SpecVersion[] = ['v1', 'v2', 'v3', 'v4'];

    for (const v of versions) {
      const spec = buildOpenApiSpec(v) as any;

      // 1. Check components.schemas has all 6 required components
      const schemaKeys = Object.keys(spec.components?.schemas || {});
      expect(schemaKeys).toContain('Cart');
      expect(schemaKeys).toContain('CartItem');
      expect(schemaKeys).toContain('DeliveryLocation');
      expect(schemaKeys).toContain('PriceBreakdown');
      expect(schemaKeys).toContain('ErrorEnvelope');
      expect(schemaKeys).toContain('CheckoutResponse');

      // 2. Check Cart schema uses $ref for CartItem, PriceBreakdown, DeliveryLocation
      const cartSchema = spec.components.schemas.Cart;
      expect(cartSchema.properties.items.items.$ref).toBe('#/components/schemas/CartItem');
      expect(cartSchema.properties.breakdown.$ref).toBe('#/components/schemas/PriceBreakdown');
      expect(
        cartSchema.properties.deliveryLocation.allOf?.some(
          (s: any) => s.$ref === '#/components/schemas/DeliveryLocation'
        )
      ).toBe(true);

      // 3. Check endpoint responses use $ref to components.schemas
      expect(spec.paths['/v1/location'].post.responses['200'].content['application/json'].schema.$ref).toBe(
        '#/components/schemas/DeliveryLocation'
      );
      expect(spec.paths['/v1/cart'].get.responses['200'].content['application/json'].schema.$ref).toBe(
        '#/components/schemas/Cart'
      );
      expect(spec.paths['/v1/cart/items'].put.responses['200'].content['application/json'].schema.$ref).toBe(
        '#/components/schemas/Cart'
      );
      expect(spec.paths['/v1/checkout'].post.responses['201'].content['application/json'].schema.$ref).toBe(
        '#/components/schemas/CheckoutResponse'
      );
      expect(spec.paths['/v1/cart'].get.responses['500'].content['application/json'].schema.$ref).toBe(
        '#/components/schemas/ErrorEnvelope'
      );

      // 4. Check components.parameters has x-session-id and operations $ref it
      expect(spec.components?.parameters?.['x-session-id']).toBeDefined();
      expect(spec.components.parameters['x-session-id'].name).toBe('x-session-id');

      for (const pathObj of Object.values(spec.paths as Record<string, any>)) {
        for (const op of Object.values(pathObj as Record<string, any>)) {
          const hasSessionRef = op.parameters?.some(
            (p: any) => p.$ref === '#/components/parameters/x-session-id'
          );
          expect(hasSessionRef).toBe(true);
        }
      }
    }
  });

  // --- Rule 3: required: true on request bodies ---
  test('requestBody on setLocation, updateCart, and applyPromo (or applyCoupon) has required: true', () => {
    const versions: SpecVersion[] = ['v1', 'v2', 'v3', 'v4'];

    for (const v of versions) {
      const spec = buildOpenApiSpec(v) as any;

      expect(spec.paths['/v1/location'].post.requestBody.required).toBe(true);
      expect(spec.paths['/v1/cart/items'].put.requestBody.required).toBe(true);

      if (v !== 'v4') {
        expect(spec.paths['/v1/cart/promo'].post.requestBody.required).toBe(true);
      } else {
        expect(spec.paths['/v1/cart/coupons'].post.requestBody.required).toBe(true);
      }
    }
  });

  // --- Rule 4: Remove substituteAllowed from v1 responses ---
  test('substituteAllowed is absent from v1 responses (belongs to v2+)', () => {
    // v1 schema check
    const specV1 = buildOpenApiSpec('v1') as any;
    expect(specV1.components.schemas.CartItem.properties.substituteAllowed).toBeUndefined();

    // v2+ schema check
    const specV2 = buildOpenApiSpec('v2') as any;
    expect(specV2.components.schemas.CartItem.properties.substituteAllowed).toBeDefined();

    const specV3 = buildOpenApiSpec('v3') as any;
    expect(specV3.components.schemas.CartItem.properties.substituteAllowed).toBeDefined();

    const specV4 = buildOpenApiSpec('v4') as any;
    expect(specV4.components.schemas.CartItem.properties.substituteAllowed).toBeDefined();
  });

  // --- Rule 5: Vendor extension x-required-scope ---
  test('Vendor extension x-required-scope is present on each operation', () => {
    const versions: SpecVersion[] = ['v1', 'v2', 'v3', 'v4'];

    for (const v of versions) {
      const spec = buildOpenApiSpec(v) as any;

      expect(spec.paths['/v1/catalog/search'].get['x-required-scope']).toBe('catalog:read');
      expect(spec.paths['/v1/location'].post['x-required-scope']).toBe('cart:write');
      expect(spec.paths['/v1/cart'].get['x-required-scope']).toBe('cart:write');
      expect(spec.paths['/v1/cart/items'].put['x-required-scope']).toBe('cart:write');
      expect(spec.paths['/v1/checkout'].post['x-required-scope']).toBe('checkout:create');

      if (v !== 'v4') {
        expect(spec.paths['/v1/cart/promo'].post['x-required-scope']).toBe('cart:write');
      } else {
        expect(spec.paths['/v1/cart/coupons'].post['x-required-scope']).toBe('cart:write');
      }

      if (v !== 'v1') {
        expect(spec.paths['/v1/orders/{orderId}'].get['x-required-scope']).toBe('orders:read');
      }
    }
  });

  // --- Rule 6: End-to-End Conformance Testing Against Served /openapi.json ---

  describe('Conformance Tests: v1 Endpoints', () => {
    beforeEach(async () => {
      await request(app)
        .post('/admin/spec-version')
        .set('x-admin-key', config.ADMIN_KEY)
        .send({ version: 'v1' })
        .expect(200);
    });

    test('All v1 documented operations conform to served /openapi.json (success and error)', async () => {
      const specRes = await request(app).get('/openapi.json').expect(200);
      const spec = specRes.body;
      const sId = 'sess_conf_v1';

      // 1. setLocation
      // 1a. Success (200)
      const locSuccess = await request(app)
        .post('/v1/location')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ pincode: '302001' })
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/location', 'post', 200, locSuccess.body);

      // 1b. Error (422) - Unserviceable location
      const locErr = await request(app)
        .post('/v1/location')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ pincode: '999999' })
        .expect(422);
      validateResponseAgainstSpec(spec, '/v1/location', 'post', 422, locErr.body);
      expect(locErr.body.error.code).toBe('LOCATION_UNSERVICEABLE');

      // 2. searchCatalog
      // 2a. Success (200)
      const catSuccess = await request(app)
        .get('/v1/catalog/search?q=mango')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/catalog/search', 'get', 200, catSuccess.body);

      // 2b. Error (401) - Missing bearer auth
      const catErr = await request(app).get('/v1/catalog/search?q=mango').expect(401);
      validateResponseAgainstSpec(spec, '/v1/catalog/search', 'get', 401, catErr.body);
      expect(catErr.body.error.code).toBe('UNAUTHORIZED');

      // 3. getCart
      // 3a. Success (200)
      const cartSuccess = await request(app)
        .get('/v1/cart')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/cart', 'get', 200, cartSuccess.body);

      // 3b. Error (403) - Insufficient scope
      const cartErr = await request(app)
        .get('/v1/cart')
        .set('Authorization', `Bearer ${readonlyToken}`)
        .expect(403);
      validateResponseAgainstSpec(spec, '/v1/cart', 'get', 403, cartErr.body);
      expect(cartErr.body.error.code).toBe('INSUFFICIENT_SCOPE');

      // 4. updateCart
      // 4a. Success (200)
      const updateSuccess = await request(app)
        .put('/v1/cart/items')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ productId: 'prod_fv_01', quantity: 2 })
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/cart/items', 'put', 200, updateSuccess.body);
      // Verify substituteAllowed is not present in v1 runtime response
      expect(updateSuccess.body.items[0].substituteAllowed).toBeUndefined();

      // 4b. Error (404) - Non-existent product
      const updateErr404 = await request(app)
        .put('/v1/cart/items')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ productId: 'prod_unknown_nonexistent', quantity: 1 })
        .expect(404);
      validateResponseAgainstSpec(spec, '/v1/cart/items', 'put', 404, updateErr404.body);
      expect(updateErr404.body.error.code).toBe('PRODUCT_NOT_FOUND');

      // 5. applyPromo
      // 5a. Success (200) - WELCOME10 requires min subtotal 19900 (prod_fv_01 at 59900 * 2 = 119800 >= 19900)
      const promoSuccess = await request(app)
        .post('/v1/cart/promo')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ code: 'WELCOME10' })
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/cart/promo', 'post', 200, promoSuccess.body);
      expect(promoSuccess.body.appliedPromos).toContain('WELCOME10');

      // 5b. Error (404) - Promo not found
      const promoErr404 = await request(app)
        .post('/v1/cart/promo')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ code: 'FAKE_PROMO_CODE' })
        .expect(404);
      validateResponseAgainstSpec(spec, '/v1/cart/promo', 'post', 404, promoErr404.body);
      expect(promoErr404.body.error.code).toBe('PROMO_NOT_FOUND');

      // 6. checkout
      // 6a. Success (201)
      const checkoutSuccess = await request(app)
        .post('/v1/checkout')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .set('Idempotency-Key', 'idem_conf_v1_checkout')
        .send({ paymentMethod: 'razorpay' })
        .expect(201);
      validateResponseAgainstSpec(spec, '/v1/checkout', 'post', 201, checkoutSuccess.body);
      expect(checkoutSuccess.body.orderId).toBeDefined();

      // 6b. Error (422) - Checkout with location not set on a fresh session
      const checkoutErr422 = await request(app)
        .post('/v1/checkout')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', 'sess_fresh_no_loc')
        .set('Idempotency-Key', 'idem_conf_v1_err')
        .send({ paymentMethod: 'razorpay' })
        .expect(422);
      validateResponseAgainstSpec(spec, '/v1/checkout', 'post', 422, checkoutErr422.body);
      expect(checkoutErr422.body.error.code).toBe('LOCATION_NOT_SET');
    });
  });

  describe('Conformance Tests: v2 Endpoints', () => {
    beforeEach(async () => {
      await request(app)
        .post('/admin/spec-version')
        .set('x-admin-key', config.ADMIN_KEY)
        .send({ version: 'v2' })
        .expect(200);
    });

    test('All v2 operations conform to served /openapi.json including getOrder and substituteAllowed', async () => {
      const specRes = await request(app).get('/openapi.json').expect(200);
      const spec = specRes.body;
      const sId = 'sess_conf_v2';

      // 1. setLocation
      const locRes = await request(app)
        .post('/v1/location')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ pincode: '302001' })
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/location', 'post', 200, locRes.body);

      // 2. updateCart with substituteAllowed
      const updateRes = await request(app)
        .put('/v1/cart/items')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ productId: 'prod_fv_02', quantity: 2, substituteAllowed: true })
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/cart/items', 'put', 200, updateRes.body);
      expect(updateRes.body.items[0].substituteAllowed).toBe(true);

      // 3. checkout to create an order
      const checkoutRes = await request(app)
        .post('/v1/checkout')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .set('Idempotency-Key', 'idem_conf_v2_order')
        .send({ paymentMethod: 'razorpay', note: 'Leave at front desk' })
        .expect(201);
      validateResponseAgainstSpec(spec, '/v1/checkout', 'post', 201, checkoutRes.body);
      const createdOrderId = checkoutRes.body.orderId;

      // 4. getOrder (v2 operation)
      // 4a. Success (200)
      const getOrderSuccess = await request(app)
        .get(`/v1/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/orders/{orderId}', 'get', 200, getOrderSuccess.body);
      expect(getOrderSuccess.body.id).toBe(createdOrderId);

      // 4b. Error (404) - Non-existent order
      const getOrderErr = await request(app)
        .get('/v1/orders/ord_non_existent_12345')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .expect(404);
      validateResponseAgainstSpec(spec, '/v1/orders/{orderId}', 'get', 404, getOrderErr.body);
      expect(getOrderErr.body.error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('Conformance Tests: v3 Endpoints', () => {
    beforeEach(async () => {
      await request(app)
        .post('/admin/spec-version')
        .set('x-admin-key', config.ADMIN_KEY)
        .send({ version: 'v3' })
        .expect(200);
    });

    test('v3 checkout requires deliverySlot and conforms to served /openapi.json', async () => {
      const specRes = await request(app).get('/openapi.json').expect(200);
      const spec = specRes.body;
      const sId = 'sess_conf_v3';

      await request(app)
        .post('/v1/location')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ pincode: '302001' })
        .expect(200);

      await request(app)
        .put('/v1/cart/items')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ productId: 'prod_fv_01', quantity: 1 })
        .expect(200);

      // Error case (400) - missing deliverySlot
      const failRes = await request(app)
        .post('/v1/checkout')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .set('Idempotency-Key', 'idem_v3_fail')
        .send({ paymentMethod: 'razorpay' })
        .expect(400);
      validateResponseAgainstSpec(spec, '/v1/checkout', 'post', 400, failRes.body);
      expect(failRes.body.error.code).toBe('VALIDATION_ERROR');

      // Success case (201) - with deliverySlot
      const okRes = await request(app)
        .post('/v1/checkout')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .set('Idempotency-Key', 'idem_v3_ok')
        .send({ paymentMethod: 'razorpay', deliverySlot: 'asap' })
        .expect(201);
      validateResponseAgainstSpec(spec, '/v1/checkout', 'post', 201, okRes.body);
      expect(okRes.body.orderId).toBeDefined();
    });
  });

  describe('Conformance Tests: v4 Endpoints', () => {
    beforeEach(async () => {
      await request(app)
        .post('/admin/spec-version')
        .set('x-admin-key', config.ADMIN_KEY)
        .send({ version: 'v4' })
        .expect(200);
    });

    test('v4 replaces applyPromo with applyCoupon and conforms to served /openapi.json', async () => {
      const specRes = await request(app).get('/openapi.json').expect(200);
      const spec = specRes.body;
      const sId = 'sess_conf_v4';

      await request(app)
        .post('/v1/location')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ pincode: '302001' })
        .expect(200);

      await request(app)
        .put('/v1/cart/items')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ productId: 'prod_fv_01', quantity: 2 })
        .expect(200);

      // 1. applyCoupon success (200)
      const couponOk = await request(app)
        .post('/v1/cart/coupons')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ couponCode: 'WELCOME10' })
        .expect(200);
      validateResponseAgainstSpec(spec, '/v1/cart/coupons', 'post', 200, couponOk.body);
      expect(couponOk.body.appliedPromos).toContain('WELCOME10');

      // 2. applyCoupon error (404)
      const couponErr = await request(app)
        .post('/v1/cart/coupons')
        .set('Authorization', `Bearer ${validToken}`)
        .set('x-session-id', sId)
        .send({ couponCode: 'NOT_A_REAL_COUPON' })
        .expect(404);
      validateResponseAgainstSpec(spec, '/v1/cart/coupons', 'post', 404, couponErr.body);
      expect(couponErr.body.error.code).toBe('PROMO_NOT_FOUND');
    });
  });
});
