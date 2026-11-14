import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const CatalogQuerySchema = z.object({
  q: z.string().optional().openapi({ description: 'Search term matched case-insensitively on product name and tags' }),
  category: z.string().optional().openapi({ description: 'Filter by category name (e.g. Fruits and Vegetables)' }),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true'))
    .openapi({ description: 'Filter by in-stock status' }),
  limit: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .openapi({ description: 'Number of items to return (max 50, default 20)' }),
  cursor: z.string().optional().openapi({ description: 'Pagination cursor for next page' }),
});

export const CatalogItemSchema = z
  .object({
    id: z.string().openapi({ example: 'prod_fv_01' }),
    name: z.string().openapi({ example: 'Fresh Alphonso Mangoes' }),
    category: z.string().openapi({ example: 'Fruits and Vegetables' }),
    description: z.string().openapi({ example: 'Naturally ripened sweet Ratnagiri Alphonso mangoes.' }),
    pricePaise: z.number().int().openapi({ example: 59900, description: 'Selling price in paise' }),
    mrpPaise: z.number().int().openapi({ example: 75000, description: 'MRP in paise' }),
    unit: z.string().openapi({ example: '1 kg (4-5 pcs)' }),
    inStock: z.boolean().openapi({ example: true }),
    maxPerOrder: z.number().int().openapi({ example: 4 }),
    tags: z.array(z.string()).openapi({ example: ['mango', 'alphonso', 'fruit'] }),
  })
  .openapi({ description: 'Catalog grocery product' });

export const CatalogSearchResponseSchema = z
  .object({
    items: z.array(CatalogItemSchema),
    nextCursor: z.string().nullable().openapi({ example: 'MjA=' }),
    totalMatches: z.number().int().openapi({ example: 36 }),
  })
  .openapi({ description: 'Catalog search results with pagination' });

