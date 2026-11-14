import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const businessRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const auth = req.header('authorization');
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    return req.ip || 'anonymous';
  },
  handler: (req: Request, res: Response) => {
    if (!res.getHeader('Retry-After')) {
      res.setHeader('Retry-After', '60');
    }
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message:
          'Rate limit exceeded: 120 requests per minute limit reached for this token. Please wait before retrying.',
        requestId: req.requestId || 'unknown',
      },
    });
  },
});
