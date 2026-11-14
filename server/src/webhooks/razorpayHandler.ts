import { store } from '../store/memoryStore.js';
import { logger } from '../logger.js';
import { eventLog } from '../store/eventLog.js';

export interface WebhookProcessingResult {
  status: 'processed' | 'ignored';
  event: string;
  orderId?: string;
  message: string;
}

export function handleRazorpayWebhookPayload(
  rawEventId: string | undefined,
  payload: Record<string, unknown>
): WebhookProcessingResult {
  const event = String(payload.event || '');
  const eventId =
    rawEventId ||
    (typeof payload.id === 'string' ? payload.id : undefined) ||
    `evt_${event}_${Date.now()}`;

  // Idempotency check: ignore duplicate events
  if (store.processedWebhookEvents.has(eventId)) {
    logger.info({ eventId, event }, 'Duplicate webhook event received; ignoring.');
    eventLog.record(
      'webhook_received',
      `Duplicate webhook event ${event} ignored (${eventId})`,
      { eventId, event, duplicate: true }
    );
    return {
      status: 'ignored',
      event,
      message: 'Duplicate event already processed.',
    };
  }

  // Record event id
  store.processedWebhookEvents.add(eventId);

  // Extract orderId from webhook payload
  let orderId: string | undefined;

  const payloadObj = (payload.payload || {}) as Record<string, unknown>;
  const paymentObj = (payloadObj.payment || {}) as Record<string, unknown>;
  const paymentEntity = (paymentObj.entity || {}) as Record<string, unknown>;
  const paymentNotes = (paymentEntity.notes || {}) as Record<string, unknown>;

  const orderObj = (payloadObj.order || {}) as Record<string, unknown>;
  const orderEntity = (orderObj.entity || {}) as Record<string, unknown>;
  const orderNotes = (orderEntity.notes || {}) as Record<string, unknown>;

  // Check notes or receipt
  if (typeof paymentNotes.orderId === 'string') {
    orderId = paymentNotes.orderId;
  } else if (typeof orderNotes.orderId === 'string') {
    orderId = orderNotes.orderId;
  } else if (typeof orderEntity.receipt === 'string') {
    orderId = orderEntity.receipt;
  } else if (typeof payload.orderId === 'string') {
    orderId = payload.orderId;
  } else {
    // Attempt reverse lookup by razorpayOrderId
    const rzpOrderId =
      (paymentEntity.order_id as string) || (orderEntity.id as string);
    if (rzpOrderId) {
      for (const ord of store.orders.values()) {
        if (ord.razorpayOrderId === rzpOrderId) {
          orderId = ord.id;
          break;
        }
      }
    }
  }

  if (!orderId) {
    logger.warn({ event, payload }, 'Webhook event did not contain a recognizable order identifier.');
    eventLog.record(
      'webhook_received',
      `Webhook ${event} received but order could not be identified`,
      { eventId, event }
    );
    return {
      status: 'processed',
      event,
      message: 'Event processed, no matching QuickCart order.',
    };
  }

  const order = store.orders.get(orderId);
  if (!order) {
    logger.warn({ orderId, event }, 'Webhook refers to unknown QuickCart order.');
    eventLog.record(
      'webhook_received',
      `Webhook ${event} received for unknown order ${orderId}`,
      { eventId, event, orderId }
    );
    return {
      status: 'processed',
      event,
      orderId,
      message: `Order ${orderId} not found in memory store.`,
    };
  }

  if (event === 'payment.captured' || event === 'order.paid') {
    if (order.status !== 'PAID' && order.status !== 'FULFILLED') {
      order.status = 'PAID';
      order.paymentStatus = 'captured';
      order.paidAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();

      // Decrement stock
      for (const item of order.items) {
        const prod = store.products.get(item.productId);
        if (prod) {
          prod.stock = Math.max(0, prod.stock - item.quantity);
        }
      }

      // Clear the session cart upon confirmed payment
      store.clearCart(order.sessionKey);

      eventLog.record(
        'order_transition',
        `Order ${order.id} marked PAID via webhook. Stock decremented and cart cleared.`,
        { orderId: order.id, status: 'PAID', eventId }
      );
    }

    eventLog.record(
      'webhook_received',
      `Payment captured webhook verified for order ${order.id}`,
      { orderId: order.id, eventId, status: 'PAID' }
    );

    return {
      status: 'processed',
      event,
      orderId: order.id,
      message: `Order ${order.id} marked as PAID.`,
    };
  }

  if (event === 'payment.failed') {
    order.status = 'PAYMENT_FAILED';
    order.paymentStatus = 'failed';
    order.paymentSessionTokenValid = false; // Invalidate old session token
    order.updatedAt = new Date().toISOString();

    // Do NOT clear cart - customer can retry checkout
    eventLog.record(
      'order_transition',
      `Order ${order.id} payment failed. Cart preserved, payment session token invalidated.`,
      { orderId: order.id, status: 'PAYMENT_FAILED', eventId }
    );

    eventLog.record(
      'webhook_received',
      `Payment failed webhook received for order ${order.id}`,
      { orderId: order.id, eventId, status: 'PAYMENT_FAILED' }
    );

    return {
      status: 'processed',
      event,
      orderId: order.id,
      message: `Order ${order.id} marked as PAYMENT_FAILED.`,
    };
  }

  return {
    status: 'processed',
    event,
    orderId: order.id,
    message: `Unhandled event type '${event}' acknowledged.`,
  };
}

