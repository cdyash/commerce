import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { SpecVersion } from '../store/memoryStore.js';
import {
  ErrorEnvelopeSchema,
  PricingBreakdownSchema,
  createStatusErrorSchema,
} from '../schemas/shared/common.schema.js';
import {
  SetLocationRequestSchema,
  LocationResponseSchema,
} from '../schemas/shared/location.schema.js';
import {
  CatalogSearchResponseSchema,
} from '../schemas/shared/catalog.schema.js';
import {
  UpdateCartItemRequestSchemaV1,
  UpdateCartItemRequestSchemaV2,
  CartItemResponseSchemaV1,
  CartItemResponseSchemaV2,
} from '../schemas/shared/cart.schema.js';
import {
  ApplyPromoRequestSchema,
  ApplyCouponRequestSchema,
} from '../schemas/shared/promo.schema.js';
import {
  CheckoutRequestSchemaV1,
  CheckoutRequestSchemaV2,
  CheckoutRequestSchemaV3,
  CheckoutResponseSchema,
} from '../schemas/shared/checkout.schema.js';
import {
  OrderItemSchema,
} from '../schemas/shared/orders.schema.js';

extendZodWithOpenApi(z);

export function buildOpenApiSpec(version: SpecVersion): Record<string, unknown> {
  const registry = new OpenAPIRegistry();

  const bearerAuth = registry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Token',
    description:
      'Agent bearer token configured in AGENT_TOKENS. Example: "qc_agent_test_tok_123"',
  });

  // Parameter component: x-session-id
  const sessionHeaderParam = registry.registerComponent('parameters', 'x-session-id', {
    name: 'x-session-id',
    in: 'header',
    required: false,
    description: 'Optional isolated session ID. If omitted, "default" is used.',
    schema: {
      type: 'string',
      default: 'default',
    },
  });

  // Shared schema components: CartItem, DeliveryLocation, PriceBreakdown, Cart, ErrorEnvelope, CheckoutResponse
  // Rule 4: Remove substituteAllowed from v1 responses (belongs to v2+)
  const cartItemSchema =
    version === 'v1' ? CartItemResponseSchemaV1 : CartItemResponseSchemaV2;

  const cartItemRef = registry.register('CartItem', cartItemSchema);
  const deliveryLocationRef = registry.register('DeliveryLocation', LocationResponseSchema);
  const priceBreakdownRef = registry.register('PriceBreakdown', PricingBreakdownSchema);

  const cartSchema = z
    .object({
      items: z.array(cartItemRef),
      appliedPromos: z.array(z.string()).openapi({ example: ['WELCOME10'] }),
      breakdown: priceBreakdownRef,
      deliveryLocation: deliveryLocationRef.nullable(),
    })
    .openapi({ description: 'Full cart state with computed totals' });

  const cartRef = registry.register('Cart', cartSchema);
  const errorEnvelopeRef = registry.register('ErrorEnvelope', ErrorEnvelopeSchema);
  const checkoutResponseRef = registry.register('CheckoutResponse', CheckoutResponseSchema);

  // Status-specific error schemas with distinct error-code enums and examples
  const error400Schema = createStatusErrorSchema(
    ['VALIDATION_ERROR'],
    'VALIDATION_ERROR',
    'Request validation failed: pincode: Must be a 6-digit Indian PIN code',
    'Validation error envelope'
  );

  const error401Schema = createStatusErrorSchema(
    ['UNAUTHORIZED'],
    'UNAUTHORIZED',
    'Missing or invalid Authorization header. Must provide Bearer token: Authorization: Bearer <token>',
    'Unauthorized error envelope'
  );

  const error403Schema = createStatusErrorSchema(
    ['INSUFFICIENT_SCOPE'],
    'INSUFFICIENT_SCOPE',
    "Agent does not have the required scope for this operation.",
    'Insufficient scope error envelope'
  );

  const error404Schema = createStatusErrorSchema(
    version === 'v1'
      ? ['PRODUCT_NOT_FOUND', 'PROMO_NOT_FOUND']
      : ['PRODUCT_NOT_FOUND', 'PROMO_NOT_FOUND', 'ORDER_NOT_FOUND'],
    'PRODUCT_NOT_FOUND',
    'Resource not found in catalog or store',
    'Not found error envelope'
  );

  const error409Schema = createStatusErrorSchema(
    ['PROMO_CONFLICT', 'PRICE_MISMATCH', 'IDEMPOTENCY_KEY_REUSED'],
    'PRICE_MISMATCH',
    'Expected price mismatch or promo conflict or idempotency key reused',
    'Conflict error envelope'
  );

  const error410Schema = createStatusErrorSchema(
    ['PROMO_EXPIRED'],
    'PROMO_EXPIRED',
    'Promotional discount code has expired',
    'Promo expired error envelope'
  );

  const error422Schema = createStatusErrorSchema(
    [
      'LOCATION_UNSERVICEABLE',
      'LOCATION_NOT_SET',
      'CART_EMPTY',
      'OUT_OF_STOCK',
      'QUANTITY_EXCEEDS_LIMIT',
      'PROMO_MIN_NOT_MET',
    ],
    'LOCATION_UNSERVICEABLE',
    'Unserviceable delivery location or business constraint violation',
    'Unprocessable entity error envelope'
  );

  const error429Schema = createStatusErrorSchema(
    ['RATE_LIMITED'],
    'RATE_LIMITED',
    'Rate limit exceeded: 120 requests per minute limit reached for this token. Please wait before retrying.',
    'Rate limit exceeded error envelope'
  );

  const commonErrorResponses = {
    400: {
      description: 'Bad Request / Validation Error',
      content: {
        'application/json': {
          schema: error400Schema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Missing or invalid agent bearer token',
      content: {
        'application/json': {
          schema: error401Schema,
        },
      },
    },
    403: {
      description: 'Forbidden - Insufficient scope',
      content: {
        'application/json': {
          schema: error403Schema,
        },
      },
    },
    429: {
      description: 'Rate limit exceeded (120 req/min)',
      headers: z.object({
        'Retry-After': z.number().int().openapi({
          description: 'Number of seconds to wait before retrying',
          example: 60,
        }),
      }),
      content: {
        'application/json': {
          schema: error429Schema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: errorEnvelopeRef,
        },
      },
    },
  };

  // 1. setLocation
  registry.registerPath({
    method: 'post',
    path: '/v1/location',
    operationId: 'setLocation',
    summary: 'Set delivery pincode and calculate ETA',
    description:
      'Validates pincode against quick-commerce dark store coverage and initializes delivery parameters.',
    'x-required-scope': 'cart:write',
    security: [{ [bearerAuth.name]: [] }],
    parameters: [sessionHeaderParam.ref],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: SetLocationRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Location successfully set and serviceable',
        content: {
          'application/json': {
            schema: deliveryLocationRef,
          },
        },
      },
      422: {
        description: 'Unserviceable location or invalid pincode',
        content: {
          'application/json': {
            schema: error422Schema,
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // 2. searchCatalog
  registry.registerPath({
    method: 'get',
    path: '/v1/catalog/search',
    operationId: 'searchCatalog',
    summary: 'Search products by query, category, or stock availability',
    description: 'Performs case-insensitive search across product names and tags.',
    'x-required-scope': 'catalog:read',
    security: [{ [bearerAuth.name]: [] }],
    parameters: [
      sessionHeaderParam.ref,
      {
        name: 'q',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Search keyword',
      },
      {
        name: 'category',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Category filter',
      },
      {
        name: 'inStock',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
        description: 'Filter in-stock items',
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', default: 20, maximum: 50 },
        description: 'Page size limit',
      },
      {
        name: 'cursor',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Pagination cursor',
      },
    ],
    responses: {
      200: {
        description: 'Catalog items matching criteria',
        content: {
          'application/json': {
            schema: CatalogSearchResponseSchema,
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // 3. getCart
  registry.registerPath({
    method: 'get',
    path: '/v1/cart',
    operationId: 'getCart',
    summary: 'Retrieve session cart with authoritative pricing breakdown',
    description: 'Returns the current cart items, applied promos, and calculated pricing.',
    'x-required-scope': 'cart:write',
    security: [{ [bearerAuth.name]: [] }],
    parameters: [sessionHeaderParam.ref],
    responses: {
      200: {
        description: 'Current session cart',
        content: {
          'application/json': {
            schema: cartRef,
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // 4. updateCart
  const updateCartBodySchema =
    version === 'v1' ? UpdateCartItemRequestSchemaV1 : UpdateCartItemRequestSchemaV2;

  registry.registerPath({
    method: 'put',
    path: '/v1/cart/items',
    operationId: 'updateCart',
    summary: 'Add, update quantity, or remove an item in the cart',
    description:
      'Sets quantity for a product. Quantity 0 removes the product. Enforces stock limits and maxPerOrder.',
    'x-required-scope': 'cart:write',
    security: [{ [bearerAuth.name]: [] }],
    parameters: [sessionHeaderParam.ref],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateCartBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated cart state with server-computed totals',
        content: {
          'application/json': {
            schema: cartRef,
          },
        },
      },
      404: {
        description: 'Product not found',
        content: { 'application/json': { schema: error404Schema } },
      },
      422: {
        description: 'Out of stock or quantity exceeds limit',
        content: { 'application/json': { schema: error422Schema } },
      },
      ...commonErrorResponses,
    },
  });

  // 5. Promo endpoint (applyPromo in v1..v3, applyCoupon in v4)
  if (version !== 'v4') {
    registry.registerPath({
      method: 'post',
      path: '/v1/cart/promo',
      operationId: 'applyPromo',
      summary: 'Apply a promotional discount code to the cart',
      description:
        'Validates code against promo rules (min subtotal, exclusivity, first order, expiry).',
      'x-required-scope': 'cart:write',
      security: [{ [bearerAuth.name]: [] }],
      parameters: [sessionHeaderParam.ref],
      request: {
        body: {
          required: true,
          content: {
            'application/json': {
              schema: ApplyPromoRequestSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Promo applied successfully (or already applied no-op)',
          content: {
            'application/json': {
              schema: cartRef,
            },
          },
        },
        404: {
          description: 'Promo not found',
          content: { 'application/json': { schema: error404Schema } },
        },
        409: {
          description: 'Promo conflict',
          content: { 'application/json': { schema: error409Schema } },
        },
        410: {
          description: 'Promo expired',
          content: { 'application/json': { schema: error410Schema } },
        },
        422: {
          description: 'Promo minimum subtotal not met',
          content: { 'application/json': { schema: error422Schema } },
        },
        ...commonErrorResponses,
      },
    });
  } else {
    // v4 breaking change replaces applyPromo with applyCoupon
    registry.registerPath({
      method: 'post',
      path: '/v1/cart/coupons',
      operationId: 'applyCoupon',
      summary: 'Apply a coupon discount code to the cart (v4 API)',
      description: 'Replaces applyPromo with dedicated coupon route in API v4.',
      'x-required-scope': 'cart:write',
      security: [{ [bearerAuth.name]: [] }],
      parameters: [sessionHeaderParam.ref],
      request: {
        body: {
          required: true,
          content: {
            'application/json': {
              schema: ApplyCouponRequestSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Coupon applied successfully',
          content: {
            'application/json': {
              schema: cartRef,
            },
          },
        },
        404: {
          description: 'Coupon not found',
          content: { 'application/json': { schema: error404Schema } },
        },
        409: {
          description: 'Coupon conflict',
          content: { 'application/json': { schema: error409Schema } },
        },
        410: {
          description: 'Coupon expired',
          content: { 'application/json': { schema: error410Schema } },
        },
        422: {
          description: 'Coupon minimum subtotal not met',
          content: { 'application/json': { schema: error422Schema } },
        },
        ...commonErrorResponses,
      },
    });
  }

  // 6. checkout
  let checkoutBodySchema;
  if (version === 'v1') {
    checkoutBodySchema = CheckoutRequestSchemaV1;
  } else if (version === 'v2') {
    checkoutBodySchema = CheckoutRequestSchemaV2;
  } else {
    checkoutBodySchema = CheckoutRequestSchemaV3; // requires deliverySlot
  }

  registry.registerPath({
    method: 'post',
    path: '/v1/checkout',
    operationId: 'checkout',
    summary: 'Initiate order checkout and create payment session',
    description:
      'Creates order with PENDING_PAYMENT status and generates Razorpay order and signed session token.',
    'x-required-scope': 'checkout:create',
    security: [{ [bearerAuth.name]: [] }],
    parameters: [
      sessionHeaderParam.ref,
      {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string' },
        description: 'Unique key ensuring idempotent order creation',
      },
    ],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: checkoutBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Order created in PENDING_PAYMENT status',
        content: {
          'application/json': {
            schema: checkoutResponseRef,
          },
        },
      },
      200: {
        description: 'Idempotent replay of previously created order',
        content: {
          'application/json': {
            schema: checkoutResponseRef,
          },
        },
      },
      409: {
        description: 'Price mismatch or idempotency key reused with different payload',
        content: { 'application/json': { schema: error409Schema } },
      },
      422: {
        description: 'Location not set or cart empty',
        content: { 'application/json': { schema: error422Schema } },
      },
      ...commonErrorResponses,
    },
  });

  // 7. getOrder (v2, v3, v4)
  if (version !== 'v1') {
    const orderResponseSchema = z
      .object({
        id: z.string().openapi({ example: 'ord_1700000000000_a1b2c3d4' }),
        status: z
          .enum(['PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'EXPIRED', 'FULFILLED'])
          .openapi({ example: 'PAID' }),
        items: z.array(OrderItemSchema),
        breakdown: priceBreakdownRef,
        location: deliveryLocationRef,
        appliedPromos: z.array(z.string()).openapi({ example: ['WELCOME10'] }),
        note: z.string().optional().openapi({ example: 'Leave with guard' }),
        deliverySlot: z.enum(['asap', 'evening', 'tomorrow']).optional(),
        razorpayOrderId: z.string().openapi({ example: 'order_1234567890abcdef' }),
        razorpayKeyId: z.string().openapi({ example: 'rzp_test_merchant123' }),
        paymentStatus: z.enum(['pending', 'captured', 'failed']).openapi({ example: 'captured' }),
        createdAt: z.string().openapi({ example: '2026-11-05T12:00:00.000Z' }),
        updatedAt: z.string().openapi({ example: '2026-11-05T12:01:00.000Z' }),
        expiresAt: z.string().openapi({ example: '2026-11-05T12:15:00.000Z' }),
      })
      .openapi({ description: 'Detailed order representation' });

    registry.registerPath({
      method: 'get',
      path: '/v1/orders/{orderId}',
      operationId: 'getOrder',
      summary: 'Retrieve status and breakdown of an order',
      description: 'Available in spec v2+. Only the owning session may access the order.',
      'x-required-scope': 'orders:read',
      security: [{ [bearerAuth.name]: [] }],
      parameters: [
        sessionHeaderParam.ref,
        {
          name: 'orderId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Order ID to fetch',
        },
      ],
      responses: {
        200: {
          description: 'Order details and fulfillment status',
          content: {
            'application/json': {
              schema: orderResponseSchema,
            },
          },
        },
        404: {
          description: 'Order not found or not owned by session',
          content: { 'application/json': { schema: error404Schema } },
        },
        ...commonErrorResponses,
      },
    });
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const spec = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'QuickCart Merchant API',
      version,
      description: `Realistic Quick-Commerce Merchant API for grocery ordering (active spec version: ${version}).`,
    },
    servers: [
      {
        url: '/',
        description: 'Current QuickCart Merchant Service Host',
      },
    ],
  });

  return spec as unknown as Record<string, unknown>;
}
