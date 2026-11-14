import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { CartResponseSchema } from './cart.schema.js';

extendZodWithOpenApi(z);

export const ApplyPromoRequestSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .openapi({ example: 'WELCOME10', description: 'Promotional discount code' }),
  })
  .openapi({ description: 'Apply promo code payload' });

export const ApplyCouponRequestSchema = z
  .object({
    couponCode: z
      .string()
      .min(1)
      .openapi({ example: 'WELCOME10', description: 'Coupon discount code' }),
  })
  .openapi({ description: 'Apply coupon code payload (v4 breaking API)' });

export const PromoResponseSchema = CartResponseSchema;

