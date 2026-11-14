import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { store } from '../store/memoryStore.js';
import { AppError } from '../middleware/errorHandler.js';
import { verifyRazorpayWebhookSignature } from '../domain/payments.js';
import { handleRazorpayWebhookPayload } from '../webhooks/razorpayHandler.js';

const SimulateWebhookSchema = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(['captured', 'failed']),
});

export function simulateWebhook(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!config.DEV_TOOLS) {
      throw new AppError(
        403,
        'DEV_TOOLS_DISABLED',
        'Developer simulation tools are disabled on this instance. Set DEV_TOOLS=true to enable simulation endpoints.'
      );
    }

    const { orderId, outcome } = SimulateWebhookSchema.parse(req.body);
    const order = store.orders.get(orderId);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', `Order '${orderId}' not found for simulation.`);
    }

    const eventName = outcome === 'captured' ? 'payment.captured' : 'payment.failed';
    const eventId = `evt_sim_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const payload = {
      entity: 'event',
      account_id: 'acc_quickcart_sim',
      event: eventName,
      id: eventId,
      contains: ['payment', 'order'],
      payload: {
        payment: {
          entity: {
            id: `pay_sim_${Date.now()}`,
            order_id: order.razorpayOrderId,
            amount: order.breakdown.totalPaise,
            currency: 'INR',
            status: outcome === 'captured' ? 'captured' : 'failed',
            notes: {
              orderId: order.id,
            },
          },
        },
        order: {
          entity: {
            id: order.razorpayOrderId,
            receipt: order.id,
            notes: {
              orderId: order.id,
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const rawBodyBuffer = Buffer.from(JSON.stringify(payload), 'utf8');

    // Compute HMAC signature exactly as Razorpay does
    const signature = crypto
      .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBodyBuffer)
      .digest('hex');

    // Run through the exact same verification logic
    const isSignatureValid = verifyRazorpayWebhookSignature(rawBodyBuffer, signature);
    if (!isSignatureValid) {
      throw new AppError(500, 'SIMULATION_ERROR', 'Generated signature failed validation.');
    }

    // Execute through the exact same webhook handler code path
    const result = handleRazorpayWebhookPayload(eventId, payload);

    res.status(200).json({
      simulated: true,
      event: eventName,
      eventId,
      signature,
      result,
      updatedOrder: store.orders.get(orderId),
    });
  } catch (err) {
    next(err);
  }
}

