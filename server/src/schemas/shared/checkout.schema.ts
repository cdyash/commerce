import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const CheckoutRequestSchemaV1 = z
  .object({
    expectedTotalPaise: z
      .number()
      .int()
      .optional()
      .openapi({ example: 45925, description: 'Client expected total in paise for price-mismatch validation' }),
    paymentMethod: z
      .literal('razorpay')
      .default('razorpay')
      .openapi({ example: 'razorpay', description: 'Selected payment gateway' }),
  })
  .openapi({ description: 'Checkout payload (v1 baseline)' });

export const CheckoutRequestSchemaV2 = CheckoutRequestSchemaV1.extend({
  note: z
    .string()
    .max(250)
    .optional()
    .openapi({ example: 'Please ring bell and leave by the door', description: 'Optional delivery instructions' }),
}).openapi({ description: 'Checkout payload (v2 with note support)' });

export const CheckoutRequestSchemaV3 = CheckoutRequestSchemaV2.extend({
  deliverySlot: z
    .enum(['asap', 'evening', 'tomorrow'])
    .openapi({ example: 'asap', description: 'Required delivery slot choice in v3 (breaking change)' }),
}).openapi({ description: 'Checkout payload (v3 requires deliverySlot)' });

export const CheckoutResponseSchema = z
  .object({
    orderId: z.string().openapi({ example: 'ord_1700000000000_a1b2c3d4' }),
    status: z.literal('PENDING_PAYMENT').openapi({ example: 'PENDING_PAYMENT' }),
    totalPaise: z.number().int().openapi({ example: 45925 }),
    razorpayOrderId: z.string().openapi({ example: 'order_1234567890abcdef' }),
    razorpayKeyId: z.string().openapi({ example: 'rzp_test_merchant123' }),
    paymentSessionToken: z.string().openapi({ example: 'pst_ey...sig' }),
    expiresAt: z.string().openapi({ example: '2026-11-05T12:15:00.000Z' }),
  })
  .openapi({ description: 'Checkout order creation response' });

