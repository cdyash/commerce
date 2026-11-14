import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/auth.js';
import {
  getAdminState,
  getAdminOrders,
  getAdminOrderById,
  getAdminCatalog,
  getAdminWebhookEvents,
  setSpecVersion,
  resetStore,
} from '../admin/adminController.js';
import { simulateWebhook } from '../admin/devToolsController.js';

export const adminRouter = Router();

adminRouter.use(adminAuthMiddleware);

adminRouter.get('/state', getAdminState);
adminRouter.get('/orders', getAdminOrders);
adminRouter.get('/orders/:id', getAdminOrderById);
adminRouter.get('/catalog', getAdminCatalog);
adminRouter.get('/webhook-events', getAdminWebhookEvents);

adminRouter.post('/spec-version', setSpecVersion);
adminRouter.post('/reset', resetStore);
adminRouter.post('/dev/simulate-webhook', simulateWebhook);
