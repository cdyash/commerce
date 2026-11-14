import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header('x-request-id');
  const id = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

