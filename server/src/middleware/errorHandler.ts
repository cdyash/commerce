import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export function errorHandlerMiddleware(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = req.requestId || 'req_unknown';

  if (err instanceof AppError) {
    logger.warn({ err, requestId, code: err.code }, `AppError: ${err.message}`);
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    }));
    logger.warn({ issues, requestId }, 'Request validation failed');
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Request validation failed: ${issues.map((i) => `${i.path}: ${i.message}`).join(', ')}`,
        details: { issues },
        requestId,
      },
    });
    return;
  }

  // SyntaxError from body-parser (invalid JSON)
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    logger.warn({ err, requestId }, 'JSON parse error');
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'The request body is malformed JSON. Please check JSON syntax.',
        requestId,
      },
    });
    return;
  }

  logger.error({ err, requestId }, 'Unhandled internal server error');
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal error occurred. Please retry or contact merchant support.',
      details: isProd ? undefined : { originalMessage: err.message },
      requestId,
    },
  });
}

