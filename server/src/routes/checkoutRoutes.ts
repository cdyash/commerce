import { Router, Request, Response, NextFunction } from 'express';
import { store } from '../store/memoryStore.js';
import { requireScope } from '../middleware/scopes.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  CheckoutRequestSchemaV1,
  CheckoutRequestSchemaV2,
  CheckoutRequestSchemaV3,
} from '../schemas/shared/checkout.schema.js';
import { processCheckout } from '../domain/orders.js';

export const checkoutRouter = Router();

// operationId: checkout
checkoutRouter.post(
  '/',
  requireScope('checkout:create'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idempotencyKey = req.header('Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        throw new AppError(
          400,
          'MISSING_IDEMPOTENCY_KEY',
          "Header 'Idempotency-Key' is required for checkout requests to prevent duplicate orders."
        );
      }

      // Dynamic validation based on active spec version
      let validatedBody: {
        expectedTotalPaise?: number;
        paymentMethod: 'razorpay';
        note?: string;
        deliverySlot?: 'asap' | 'evening' | 'tomorrow';
      };

      if (store.specVersion === 'v1') {
        const parsed = CheckoutRequestSchemaV1.parse(req.body);
        validatedBody = {
          expectedTotalPaise: parsed.expectedTotalPaise,
          paymentMethod: parsed.paymentMethod,
        };
      } else if (store.specVersion === 'v2') {
        const parsed = CheckoutRequestSchemaV2.parse(req.body);
        validatedBody = {
          expectedTotalPaise: parsed.expectedTotalPaise,
          paymentMethod: parsed.paymentMethod,
          note: parsed.note,
        };
      } else {
        // v3 and v4 require deliverySlot
        const parsed = CheckoutRequestSchemaV3.parse(req.body);
        validatedBody = {
          expectedTotalPaise: parsed.expectedTotalPaise,
          paymentMethod: parsed.paymentMethod,
          note: parsed.note,
          deliverySlot: parsed.deliverySlot,
        };
      }

      const sessionKey = req.sessionKey || 'default';
      const result = await processCheckout({
        sessionKey,
        idempotencyKey: idempotencyKey.trim(),
        expectedTotalPaise: validatedBody.expectedTotalPaise,
        paymentMethod: validatedBody.paymentMethod,
        note: validatedBody.note,
        deliverySlot: validatedBody.deliverySlot,
      });

      res.status(result.statusCode).json(result.body);
    } catch (err) {
      next(err);
    }
  }
);

