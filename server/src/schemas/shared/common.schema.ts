import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({
        example: 'Request validation failed: pincode: Must be a 6-digit Indian PIN code',
      }),
      details: z.unknown().optional(),
      requestId: z.string().openapi({ example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab' }),
    }),
  })
  .openapi({ description: 'Standard unified error envelope' });

export function createStatusErrorSchema(
  codes: [string, ...string[]],
  exampleCode: string,
  exampleMessage: string,
  description?: string
) {
  return z
    .object({
      error: z.object({
        code: z.enum(codes).openapi({ example: exampleCode }),
        message: z.string().openapi({ example: exampleMessage }),
        details: z.unknown().optional(),
        requestId: z.string().openapi({ example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab' }),
      }),
    })
    .openapi({ description: description || `Error envelope for ${codes.join(' / ')}` });
}

export const PricingBreakdownSchema = z
  .object({
    subtotalPaise: z.number().int().openapi({ example: 45000, description: 'Sum of item prices in paise' }),
    discountPaise: z.number().int().openapi({ example: 4500, description: 'Total promo discount in paise' }),
    deliveryFeePaise: z.number().int().openapi({ example: 2900, description: 'Delivery fee in paise (waived if subtotal >= 49900 or FREEDEL)' }),
    handlingFeePaise: z.number().int().openapi({ example: 500, description: 'Flat handling fee in paise' }),
    gstPaise: z.number().int().openapi({ example: 2025, description: '5% GST on net subtotal in paise' }),
    totalPaise: z.number().int().openapi({ example: 45925, description: 'Authoritative final total in paise' }),
  })
  .openapi({ description: 'Authoritative price breakdown' });
