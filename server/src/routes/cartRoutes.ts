import { Router, Request, Response, NextFunction } from 'express';
import { store } from '../store/memoryStore.js';
import { requireScope } from '../middleware/scopes.js';
import {
  UpdateCartItemRequestSchemaV1,
  UpdateCartItemRequestSchemaV2,
} from '../schemas/shared/cart.schema.js';
import {
  ApplyPromoRequestSchema,
  ApplyCouponRequestSchema,
} from '../schemas/shared/promo.schema.js';
import { updateCartItem, formatCartResponse } from '../domain/cart.js';
import { validateAndApplyPromo } from '../domain/promo.js';
import { AppError } from '../middleware/errorHandler.js';
import { eventLog } from '../store/eventLog.js';

export const cartRouter = Router();

// operationId: getCart
cartRouter.get('/', requireScope('cart:write'), (req: Request, res: Response, next: NextFunction): void => {
  try {
    const sessionKey = req.sessionKey || 'default';
    const cart = store.getCart(sessionKey);
    const location = store.locations.get(sessionKey);
    const orders = store.getSessionOrders(sessionKey);
    const isFirstOrder = !orders.some((o) => o.status === 'PAID' || o.status === 'FULFILLED');

    const response = formatCartResponse(
      cart,
      store.products,
      store.promos,
      location,
      isFirstOrder,
      store.specVersion
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// operationId: updateCart
cartRouter.put(
  '/items',
  requireScope('cart:write'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const sessionKey = req.sessionKey || 'default';
      const cart = store.getCart(sessionKey);
      const location = store.locations.get(sessionKey);
      const orders = store.getSessionOrders(sessionKey);
      const isFirstOrder = !orders.some((o) => o.status === 'PAID' || o.status === 'FULFILLED');

      // Validate according to active spec version
      const validated =
        store.specVersion === 'v1'
          ? UpdateCartItemRequestSchemaV1.parse(req.body)
          : UpdateCartItemRequestSchemaV2.parse(req.body);

      const response = updateCartItem({
        cart,
        productId: validated.productId,
        quantity: validated.quantity,
        substituteAllowed:
          'substituteAllowed' in validated
            ? (validated as { substituteAllowed?: boolean }).substituteAllowed
            : undefined,
        productsMap: store.products,
        promosMap: store.promos,
        location,
        isFirstOrder,
        specVersion: store.specVersion,
      });

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

// operationId: applyPromo (v1, v2, v3)
cartRouter.post(
  '/promo',
  requireScope('cart:write'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (store.specVersion === 'v4') {
        throw new AppError(
          404,
          'ENDPOINT_DEPRECATED',
          'POST /v1/cart/promo has been removed in spec v4. Please use POST /v1/cart/coupons instead.'
        );
      }

      const validated = ApplyPromoRequestSchema.parse(req.body);
      const sessionKey = req.sessionKey || 'default';
      const cart = store.getCart(sessionKey);
      const location = store.locations.get(sessionKey);
      const orders = store.getSessionOrders(sessionKey);
      const isFirstOrder = !orders.some((o) => o.status === 'PAID' || o.status === 'FULFILLED');

      // Calculate current subtotal for promo eligibility
      let subtotalPaise = 0;
      for (const item of cart.items) {
        const prod = store.products.get(item.productId);
        if (prod) {
          subtotalPaise += prod.pricePaise * item.quantity;
        }
      }

      try {
        const result = validateAndApplyPromo({
          code: validated.code,
          subtotalPaise,
          currentAppliedCodes: cart.appliedPromos,
          promosMap: store.promos,
          isFirstOrder,
        });

        cart.appliedPromos = result.updatedAppliedCodes;
      } catch (promoErr) {
        if (promoErr instanceof AppError) {
          eventLog.record(
            'promo_rejected',
            `Promo '${validated.code}' rejected for session: ${promoErr.message}`,
            { sessionKey, code: validated.code, codeError: promoErr.code }
          );
        }
        throw promoErr;
      }

      const response = formatCartResponse(
        cart,
        store.products,
        store.promos,
        location,
        isFirstOrder,
        store.specVersion
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

// operationId: applyCoupon (v4 breaking replacement)
cartRouter.post(
  '/coupons',
  requireScope('cart:write'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (store.specVersion !== 'v4') {
        throw new AppError(
          404,
          'NOT_FOUND',
          `POST /v1/cart/coupons is only available in spec v4 (current spec is ${store.specVersion}).`
        );
      }

      const validated = ApplyCouponRequestSchema.parse(req.body);
      const sessionKey = req.sessionKey || 'default';
      const cart = store.getCart(sessionKey);
      const location = store.locations.get(sessionKey);
      const orders = store.getSessionOrders(sessionKey);
      const isFirstOrder = !orders.some((o) => o.status === 'PAID' || o.status === 'FULFILLED');

      let subtotalPaise = 0;
      for (const item of cart.items) {
        const prod = store.products.get(item.productId);
        if (prod) {
          subtotalPaise += prod.pricePaise * item.quantity;
        }
      }

      const result = validateAndApplyPromo({
        code: validated.couponCode,
        subtotalPaise,
        currentAppliedCodes: cart.appliedPromos,
        promosMap: store.promos,
        isFirstOrder,
      });

      cart.appliedPromos = result.updatedAppliedCodes;

      const response = formatCartResponse(
        cart,
        store.products,
        store.promos,
        location,
        isFirstOrder,
        store.specVersion
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);
