import { AdminState, HealthStatus, Order, Product, SystemEvent } from '../types';

let inMemoryAdminKey = '';

export function getAdminKey(): string {
  return inMemoryAdminKey;
}

export function setAdminKey(key: string): void {
  inMemoryAdminKey = key.trim();
}

export function hasAdminKey(): boolean {
  return inMemoryAdminKey.length > 0;
}

const BASE_URL = '';

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAdminState(): Promise<AdminState> {
  if (!inMemoryAdminKey) {
    throw new Error('Admin key required');
  }

  const res = await fetch(`${BASE_URL}/admin/state`, {
    headers: {
      'x-admin-key': inMemoryAdminKey,
    },
  });

  if (res.status === 401) {
    throw new Error('INVALID_ADMIN_KEY');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch admin state: ${res.status}`);
  }

  return res.json();
}

export async function fetchAdminOrders(): Promise<Order[]> {
  if (!inMemoryAdminKey) {
    throw new Error('Admin key required');
  }

  const res = await fetch(`${BASE_URL}/admin/orders`, {
    headers: {
      'x-admin-key': inMemoryAdminKey,
    },
  });

  if (res.status === 401) {
    throw new Error('INVALID_ADMIN_KEY');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch orders: ${res.status}`);
  }

  const data = await res.json();
  return data.orders || [];
}

export async function fetchAdminOrder(id: string): Promise<Order> {
  if (!inMemoryAdminKey) {
    throw new Error('Admin key required');
  }

  const res = await fetch(`${BASE_URL}/admin/orders/${encodeURIComponent(id)}`, {
    headers: {
      'x-admin-key': inMemoryAdminKey,
    },
  });

  if (res.status === 401) {
    throw new Error('INVALID_ADMIN_KEY');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch order ${id}: ${res.status}`);
  }

  return res.json();
}

export async function fetchAdminCatalog(): Promise<Product[]> {
  if (!inMemoryAdminKey) {
    throw new Error('Admin key required');
  }

  const res = await fetch(`${BASE_URL}/admin/catalog`, {
    headers: {
      'x-admin-key': inMemoryAdminKey,
    },
  });

  if (res.status === 401) {
    throw new Error('INVALID_ADMIN_KEY');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch catalog: ${res.status}`);
  }

  const data = await res.json();
  return data.items || [];
}

export async function fetchAdminWebhookEvents(): Promise<SystemEvent[]> {
  if (!inMemoryAdminKey) {
    throw new Error('Admin key required');
  }

  const res = await fetch(`${BASE_URL}/admin/webhook-events`, {
    headers: {
      'x-admin-key': inMemoryAdminKey,
    },
  });

  if (res.status === 401) {
    throw new Error('INVALID_ADMIN_KEY');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch webhook events: ${res.status}`);
  }

  const data = await res.json();
  return data.events || [];
}

export async function switchSpecVersion(version: 'v1' | 'v2' | 'v3' | 'v4'): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/spec-version`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': inMemoryAdminKey,
    },
    body: JSON.stringify({ version }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to switch spec version');
  }
}

export async function resetStore(): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/reset`, {
    method: 'POST',
    headers: {
      'x-admin-key': inMemoryAdminKey,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to reset merchant store');
  }
}

export async function simulateWebhook(
  orderId: string,
  outcome: 'captured' | 'failed'
): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/dev/simulate-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': inMemoryAdminKey,
    },
    body: JSON.stringify({ orderId, outcome }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Webhook simulation failed');
  }
}
