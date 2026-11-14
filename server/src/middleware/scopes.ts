import { Request, Response, NextFunction } from 'express';
import { Scope } from '../config.js';
import { AppError } from './errorHandler.js';

/**
 * Ensures the authenticated agent possesses the required scope.
 */
export function requireScope(requiredScope: Scope) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.agent) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required before checking scopes.');
    }

    if (!req.agent.scopes.includes(requiredScope)) {
      throw new AppError(
        403,
        'INSUFFICIENT_SCOPE',
        `Agent '${req.agent.name}' does not have the required scope '${requiredScope}'.`,
        {
          requiredScope,
          grantedScopes: req.agent.scopes,
        }
      );
    }

    next();
  };
}

