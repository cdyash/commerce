import { Router, Request, Response, NextFunction } from 'express';
import { SetLocationRequestSchema } from '../schemas/shared/location.schema.js';
import { lookupPincode } from '../domain/location.js';
import { store } from '../store/memoryStore.js';
import { eventLog } from '../store/eventLog.js';
import { requireScope } from '../middleware/scopes.js';

export const locationRouter = Router();

// operationId: setLocation
locationRouter.post(
  '/',
  requireScope('cart:write'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = SetLocationRequestSchema.parse(req.body);
      const sessionKey = req.sessionKey || 'default';

      const location = lookupPincode(validated.pincode, store.pincodes, validated.label);
      store.locations.set(sessionKey, location);

      eventLog.record(
        'request',
        `Delivery location set to ${location.pincode} (${location.area}, ${location.city})`,
        { sessionKey, pincode: location.pincode }
      );

      res.status(200).json(location);
    } catch (err) {
      next(err);
    }
  }
);

