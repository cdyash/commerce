import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { PricingBreakdownSchema } from './common.schema.js';
import { LocationResponseSchema } from './location.schema.js';

extendZodWithOpenApi(z);

export const OrderParamsSchema = z.object({
  orderId: z.string().openapi({ example: 'ord_1700000000000_a1b2c3d4', description: 'Unique order identifier' }),
});

export const OrderItemSchema = z
  .object({
    productId: z.string().openapi({ example: 'prod_fv_01' }),
    name: z.string().openapi({ example: 'Fresh Alphonso Mangoes' }),
    unit: z.string().openapi({ example: '1 kg' }),
    quantity: z.number().int().openapi({ example: 2 }),
    pricePaise: z.number().int().openapi({ example: 59900 }),
    totalPaise: z.number().int().openapi({ example: 119800 }),
    substituteAllowed: z.boolean().optional(),
  })
  .openapi({ description: 'Purchased order line' });

export const OrderResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'ord_1700000000000_a1b2c3d4' }),
    status: z
      .enum(['PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'EXPIRED', 'FULFILLED'])
      .openapi({ example: 'PAID' }),
    items: z.array(OrderItemSchema),
    breakdown: PricingBreakdownSchema,
    location: LocationResponseSchema,
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

