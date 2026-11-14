import { Router, Request, Response, NextFunction } from 'express';
import { store } from '../store/memoryStore.js';
import { requireScope } from '../middleware/scopes.js';
import { AppError } from '../middleware/errorHandler.js';
import { OrderParamsSchema } from '../schemas/shared/orders.schema.js';

export const orderRouter = Router();

// operationId: getOrder
orderRouter.get(
  '/:orderId',
  requireScope('orders:read'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (store.specVersion === 'v1') {
        throw new AppError(
          404,
          'NOT_FOUND',
          'The endpoint GET /v1/orders/{orderId} is not available in spec version v1. It was introduced in spec v2.'
        );
      }

      const params = OrderParamsSchema.parse(req.params);
      const sessionKey = req.sessionKey || 'default';

      const order = store.orders.get(params.orderId);
      if (!order || order.sessionKey !== sessionKey) {
        throw new AppError(
          404,
          'ORDER_NOT_FOUND',
          `Order '${params.orderId}' was not found for this session.`
        );
      }

      res.status(200).json({
        id: order.id,
        status: order.status,
        items: order.items,
        breakdown: order.breakdown,
        location: order.location,
        appliedPromos: order.appliedPromos,
        note: order.note,
        deliverySlot: order.deliverySlot,
        razorpayOrderId: order.razorpayOrderId,
        razorpayKeyId: order.razorpayKeyId,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        expiresAt: order.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

