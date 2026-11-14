import { Router, Request, Response, NextFunction } from 'express';
import { CatalogQuerySchema } from '../schemas/shared/catalog.schema.js';
import { searchCatalog } from '../domain/catalog.js';
import { store } from '../store/memoryStore.js';
import { requireScope } from '../middleware/scopes.js';

export const catalogRouter = Router();

// operationId: searchCatalog
catalogRouter.get(
  '/search',
  requireScope('catalog:read'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = CatalogQuerySchema.parse(req.query);
      const results = searchCatalog(store.products, validated);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  }
);

