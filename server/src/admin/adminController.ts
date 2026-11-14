import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { store, SpecVersion } from '../store/memoryStore.js';
import { eventLog } from '../store/eventLog.js';

const SpecVersionSchema = z.object({
  version: z.enum(['v1', 'v2', 'v3', 'v4']),
});

export function getAdminState(_req: Request, res: Response): void {
  const allOrders = Array.from(store.orders.values());
  const counts = {
    products: store.products.size,
    ordersTotal: allOrders.length,
    ordersPending: allOrders.filter((o) => o.status === 'PENDING_PAYMENT').length,
    ordersPaid: allOrders.filter((o) => o.status === 'PAID').length,
    ordersFulfilled: allOrders.filter((o) => o.status === 'FULFILLED').length,
    ordersFailed: allOrders.filter((o) => o.status === 'PAYMENT_FAILED').length,
    ordersExpired: allOrders.filter((o) => o.status === 'EXPIRED').length,
    activeSessions: store.carts.size,
    processedWebhooks: store.processedWebhookEvents.size,
  };

  res.status(200).json({
    specVersion: store.specVersion,
    counts,
    recentEvents: eventLog.getRecent(50),
    orders: allOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

export function getAdminOrders(_req: Request, res: Response): void {
  const orders = Array.from(store.orders.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  res.status(200).json({ orders, total: orders.length });
}

export function getAdminOrderById(req: Request, res: Response): void {
  const orderId = req.params.id;
  const order = store.orders.get(orderId);
  if (!order) {
    res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: `Order '${orderId}' was not found.`,
        requestId: req.requestId || 'unknown',
      },
    });
    return;
  }
  res.status(200).json(order);
}

export function getAdminCatalog(_req: Request, res: Response): void {
  const items = Array.from(store.products.values()).map((p) => ({
    ...p,
    inStock: p.stock > 0,
  }));
  res.status(200).json({ items, total: items.length });
}

export function getAdminWebhookEvents(_req: Request, res: Response): void {
  const events = eventLog
    .getRecent(100)
    .filter((e) => e.type === 'webhook_received');
  res.status(200).json({ events, total: events.length });
}

export function setSpecVersion(req: Request, res: Response, next: NextFunction): void {
  try {
    const { version } = SpecVersionSchema.parse(req.body);
    const previous = store.specVersion;
    store.specVersion = version as SpecVersion;

    eventLog.record(
      'spec_changed',
      `OpenAPI specification switched from ${previous} to ${version}`,
      { previous, current: version }
    );

    res.status(200).json({
      message: `Specification version updated to ${version}`,
      specVersion: version,
      previousVersion: previous,
    });
  } catch (err) {
    next(err);
  }
}

export function resetStore(_req: Request, res: Response): void {
  store.reset();
  res.status(200).json({
    message: 'QuickCart merchant store has been reset to initial seeded state.',
    specVersion: store.specVersion,
  });
}
