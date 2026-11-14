import { Request, Response, NextFunction } from 'express';
import { config, AgentTokenConfig } from '../config.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      agent?: AgentTokenConfig;
      sessionId?: string;
      sessionKey?: string;
    }
  }
}

/**
 * Bearer token auth for business routes.
 * Identifies the calling agent and resolves their session key.
 */
export function agentAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'Missing or invalid Authorization header. Must provide Bearer token: Authorization: Bearer <token>'
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Bearer token cannot be empty.');
  }

  const agent = config.agentTokenMap.get(token);
  if (!agent) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'Invalid agent bearer token. Check configured AGENT_TOKENS or your credentials.'
    );
  }

  const sessionId = req.header('x-session-id')?.trim() || 'default';
  const sessionKey = `${token}:${sessionId}`;

  req.agent = agent;
  req.sessionId = sessionId;
  req.sessionKey = sessionKey;
  next();
}

/**
 * Admin key authorization for /admin/* endpoints.
 */
export function adminAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const adminKey = req.header('x-admin-key');
  if (!adminKey || adminKey !== config.ADMIN_KEY) {
    throw new AppError(
      401,
      'UNAUTHORIZED_ADMIN',
      'Invalid or missing x-admin-key header for admin operation.'
    );
  }
  next();
}
