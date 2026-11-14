import express, { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * Middleware that captures the raw Buffer for webhook HMAC verification.
 * Configured specifically on raw body routes like /webhooks/razorpay.
 */
export const webhookRawBodyParser = [
  express.raw({ type: '*/*', limit: '1mb' }),
  (req: Request, _res: Response, next: NextFunction): void => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    } else if (typeof req.body === 'string') {
      req.rawBody = Buffer.from(req.body, 'utf8');
    } else {
      req.rawBody = Buffer.from('');
    }
    next();
  },
];

