import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { PricingBreakdownSchema } from './common.schema.js';
import { LocationResponseSchema } from './location.schema.js';

extendZodWithOpenApi(z);

export const UpdateCartItemRequestSchemaV1 = z
  .object({
    productId: z.string().min(1).openapi({ example: 'prod_fv_01', description: 'Product ID to add, update, or remove' }),
    quantity: z.number().int().min(0).openapi({ example: 2, description: 'Desired quantity. 0 removes the item from the cart.' }),
  })
  .openapi({ description: 'Cart update item payload' });

export const UpdateCartItemRequestSchemaV2 = UpdateCartItemRequestSchemaV1.extend({
  substituteAllowed: z
    .boolean()
    .optional()
    .openapi({ example: true, description: 'Optional consent for automated substitution if product goes out of stock' }),
}).openapi({ description: 'Cart update item payload (v2 with substitute support)' });

export const CartItemResponseSchemaV1 = z
  .object({
    productId: z.string().openapi({ example: 'prod_fv_01' }),
    name: z.string().openapi({ example: 'Fresh Alphonso Mangoes' }),
    category: z.string().openapi({ example: 'Fruits and Vegetables' }),
    unit: z.string().openapi({ example: '1 kg' }),
    pricePaise: z.number().int().openapi({ example: 59900 }),
    quantity: z.number().int().openapi({ example: 2 }),
    totalPaise: z.number().int().openapi({ example: 119800 }),
  })
  .openapi({ description: 'Cart item line (v1 baseline)' });

export const CartItemResponseSchemaV2 = CartItemResponseSchemaV1.extend({
  substituteAllowed: z.boolean().optional().openapi({ example: true }),
}).openapi({ description: 'Cart item line (v2 with substitute support)' });

export const CartItemResponseSchema = CartItemResponseSchemaV2;

export const CartResponseSchemaV1 = z
  .object({
    items: z.array(CartItemResponseSchemaV1),
    appliedPromos: z.array(z.string()).openapi({ example: ['WELCOME10'] }),
    breakdown: PricingBreakdownSchema,
    deliveryLocation: LocationResponseSchema.nullable(),
  })
  .openapi({ description: 'Full cart state with computed totals (v1)' });

export const CartResponseSchemaV2 = z
  .object({
    items: z.array(CartItemResponseSchemaV2),
    appliedPromos: z.array(z.string()).openapi({ example: ['WELCOME10'] }),
    breakdown: PricingBreakdownSchema,
    deliveryLocation: LocationResponseSchema.nullable(),
  })
  .openapi({ description: 'Full cart state with computed totals (v2)' });

export const CartResponseSchema = CartResponseSchemaV2;
