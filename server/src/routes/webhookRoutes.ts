import { Router, Request, Response } from 'express';
import { webhookRawBodyParser } from '../middleware/rawBody.js';
import { verifyRazorpayWebhookSignature } from '../domain/payments.js';
import { handleRazorpayWebhookPayload } from '../webhooks/razorpayHandler.js';
import { logger } from '../logger.js';
import { eventLog } from '../store/eventLog.js';

export const webhookRouter = Router();

// Raw body parser mounted specifically for Razorpay webhook route
webhookRouter.post('/razorpay', ...webhookRawBodyParser, (req: Request, res: Response): void => {
  const signature = req.header('x-razorpay-signature');
  const eventId = req.header('x-razorpay-event-id');
  const rawBody = req.rawBody || Buffer.from('');

  // 1. Verify HMAC signature with timing-safe comparison
  const isValid = verifyRazorpayWebhookSignature(rawBody, signature);

  if (!isValid) {
    logger.warn({ signature, eventId }, 'Invalid Razorpay webhook signature rejected.');
    eventLog.record(
      'webhook_received',
      `Webhook rejected: invalid HMAC signature (Header: ${signature?.slice(0, 10)}...)`,
      { validSignature: false, eventId }
    );

    res.status(400).json({
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'The x-razorpay-signature header is missing or does not match the computed HMAC signature.',
        requestId: req.requestId || 'unknown',
      },
    });
    return;
  }

  // 2. Parse JSON payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    logger.warn({ err }, 'Webhook body was not valid JSON.');
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Webhook body could not be parsed as valid JSON.',
        requestId: req.requestId || 'unknown',
      },
    });
    return;
  }

  // 3. Process business logic idempotently
  const result = handleRazorpayWebhookPayload(eventId, payload);
  res.status(200).json(result);
});

