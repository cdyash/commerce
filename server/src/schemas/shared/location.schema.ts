import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const SetLocationRequestSchema = z
  .object({
    pincode: z
      .string()
      .regex(/^\d{6}$/, 'PIN code must be exactly 6 digits')
      .openapi({ example: '302001', description: '6-digit Indian postal PIN code' }),
    label: z
      .string()
      .max(50)
      .optional()
      .openapi({ example: 'Home', description: 'Optional human label for the location' }),
  })
  .openapi({ description: 'Payload to set the delivery location for the session' });

export const LocationResponseSchema = z
  .object({
    pincode: z.string().openapi({ example: '302001' }),
    area: z.string().openapi({ example: 'MI Road / C-Scheme' }),
    city: z.string().openapi({ example: 'Jaipur' }),
    etaMinutes: z.number().int().openapi({ example: 15, description: 'Estimated delivery ETA in minutes' }),
    deliveryFeePaise: z.number().int().openapi({ example: 2900, description: 'Delivery fee in paise' }),
    serviceable: z.literal(true).openapi({ example: true }),
    label: z.string().optional().openapi({ example: 'Home' }),
  })
  .openapi({ description: 'Location confirmation with ETA and delivery fee' });

