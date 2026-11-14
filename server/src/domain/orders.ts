import crypto from 'node:crypto';
import { store, Order, OrderItem } from '../store/memoryStore.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculatePricing } from './pricing.js';
import { createPaymentSessionToken, createRazorpayOrder } from './payments.js';
import { eventLog } from '../store/eventLog.js';

export interface CheckoutInput {
  sessionKey: string;
  idempotencyKey: string;
  expectedTotalPaise?: number;
  paymentMethod: 'razorpay';
  note?: string;
  deliverySlot?: 'asap' | 'evening' | 'tomorrow';
}

export interface CheckoutResult {
  orderId: string;
  status: 'PENDING_PAYMENT';
  totalPaise: number;
  razorpayOrderId: string;
  razorpayKeyId: string;
  paymentSessionToken: string;
  expiresAt: string;
}

export async function processCheckout(input: CheckoutInput): Promise<{
  statusCode: number;
  body: CheckoutResult;
}> {
  const {
    sessionKey,
    idempotencyKey,
    expectedTotalPaise,
    paymentMethod,
    note,
    deliverySlot,
  } = input;

  if (paymentMethod !== 'razorpay') {
    throw new AppError(400, 'UNSUPPORTED_PAYMENT_METHOD', `Payment method '${paymentMethod}' is not supported. Use 'razorpay'.`);
  }

  // Idempotency check
  const idempotencyStorageKey = `${sessionKey}:${idempotencyKey}`;
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ expectedTotalPaise, paymentMethod, note, deliverySlot }))
    .digest('hex');

  const existingRecord = store.idempotencyKeys.get(idempotencyStorageKey);
  if (existingRecord) {
    if (existingRecord.requestPayloadHash !== payloadHash) {
      throw new AppError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        `Idempotency-Key '${idempotencyKey}' was previously used with a different request payload. Reuse of keys with modified payloads is prohibited.`
      );
    }
    // Return previously generated order
    return {
      statusCode: 200,
      body: existingRecord.responseBody as CheckoutResult,
    };
  }

  // 1. Validate location
  const location = store.locations.get(sessionKey);
  if (!location) {
    throw new AppError(
      422,
      'LOCATION_NOT_SET',
      'Delivery location must be set before checkout. Please call POST /v1/location first.'
    );
  }

  // 2. Validate cart
  const cart = store.getCart(sessionKey);
  if (cart.items.length === 0) {
    throw new AppError(
      422,
      'CART_EMPTY',
      'Cannot checkout with an empty cart. Please add items to your cart first.'
    );
  }

  // Re-verify stock and prepare order items
  const orderItems: OrderItem[] = [];
  const pricingItems: { pricePaise: number; quantity: number }[] = [];

  for (const ci of cart.items) {
    const product = store.products.get(ci.productId);
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product '${ci.productId}' in cart no longer exists.`);
    }
    if (product.stock < ci.quantity) {
      throw new AppError(
        422,
        'OUT_OF_STOCK',
        `Insufficient stock for '${product.name}'. Requested ${ci.quantity}, only ${product.stock} available.`,
        { productId: product.id, requestedQuantity: ci.quantity, availableStock: product.stock }
      );
    }

    const lineTotal = product.pricePaise * ci.quantity;
    orderItems.push({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      quantity: ci.quantity,
      pricePaise: product.pricePaise,
      totalPaise: lineTotal,
      substituteAllowed: ci.substituteAllowed,
    });

    pricingItems.push({
      pricePaise: product.pricePaise,
      quantity: ci.quantity,
    });
  }

  // Check first order status for session
  const previousOrders = store.getSessionOrders(sessionKey);
  const isFirstOrder = !previousOrders.some((o) => o.status === 'PAID' || o.status === 'FULFILLED');

  // Authoritative pricing
  const pricing = calculatePricing({
    items: pricingItems,
    appliedPromos: cart.appliedPromos,
    promosMap: store.promos,
    locationDeliveryFeePaise: location.deliveryFeePaise,
    isFirstOrder,
  });

  const actualTotalPaise = pricing.totalPaise;

  // 3. Price mismatch check
  if (expectedTotalPaise !== undefined && expectedTotalPaise !== actualTotalPaise) {
    throw new AppError(
      409,
      'PRICE_MISMATCH',
      `The expected total (₹${(expectedTotalPaise / 100).toFixed(2)}) does not match authoritative calculated total (₹${(actualTotalPaise / 100).toFixed(2)}). Cart prices or promos may have updated.`,
      {
        expectedTotalPaise,
        actualTotalPaise,
        breakdown: pricing.breakdown,
      }
    );
  }

  const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry

  // Create Razorpay order
  const razorpayOrderId = await createRazorpayOrder(orderId, actualTotalPaise);

  // Create signed payment session token
  const paymentSessionToken = createPaymentSessionToken(orderId, actualTotalPaise, expiresAt);

  const order: Order = {
    id: orderId,
    sessionKey,
    status: 'PENDING_PAYMENT',
    items: orderItems,
    breakdown: pricing.breakdown,
    location: { ...location },
    appliedPromos: [...pricing.activePromoCodes],
    note,
    deliverySlot,
    razorpayOrderId,
    razorpayKeyId: config.RAZORPAY_KEY_ID,
    paymentSessionToken,
    paymentSessionTokenValid: true,
    paymentStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt,
  };

  store.orders.set(orderId, order);

  const responseBody: CheckoutResult = {
    orderId,
    status: 'PENDING_PAYMENT',
    totalPaise: actualTotalPaise,
    razorpayOrderId,
    razorpayKeyId: config.RAZORPAY_KEY_ID,
    paymentSessionToken,
    expiresAt,
  };

  // Save idempotency record
  store.idempotencyKeys.set(idempotencyStorageKey, {
    requestPayloadHash: payloadHash,
    orderId,
    responseBody,
  });

  eventLog.record(
    'order_transition',
    `Order ${orderId} created (Awaiting payment - ₹${(actualTotalPaise / 100).toFixed(2)})`,
    { orderId, status: 'PENDING_PAYMENT', totalPaise: actualTotalPaise }
  );

  return {
    statusCode: 201,
    body: responseBody,
  };
}

/**
 * Single periodic sweeper for order expiration (15 min) and fulfilment (20 s).
 * Transitions are based strictly on stored timestamps so the sweeper is safe
 * to run repeatedly and survives a slow tick.
 */
export function runOrderSweeper(): void {
  const now = Date.now();
  for (const order of store.orders.values()) {
    // 1. Expiration check for PENDING_PAYMENT orders (15 min)
    if (order.status === 'PENDING_PAYMENT') {
      const expiresAtMs = new Date(order.expiresAt).getTime();
      if (now >= expiresAtMs) {
        order.status = 'EXPIRED';
        order.paymentSessionTokenValid = false;
        order.updatedAt = new Date().toISOString();
        eventLog.record(
          'order_transition',
          `Order ${order.id} expired after 15 minutes pending payment.`,
          { orderId: order.id, status: 'EXPIRED' }
        );
      }
    }

    // 2. Fulfilment check for PAID orders (20 s after payment)
    if (order.status === 'PAID') {
      const paidTimeMs = order.paidAt
        ? new Date(order.paidAt).getTime()
        : new Date(order.updatedAt).getTime();
      if (now - paidTimeMs >= 20000) {
        order.status = 'FULFILLED';
        order.updatedAt = new Date().toISOString();
        eventLog.record(
          'order_transition',
          `Order ${order.id} simulated fulfillment completed.`,
          { orderId: order.id, status: 'FULFILLED' }
        );
      }
    }
  }
}
