export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'EXPIRED'
  | 'FULFILLED';

export interface PricingBreakdown {
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  gstPaise: number;
  totalPaise: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  pricePaise: number;
  totalPaise: number;
  substituteAllowed?: boolean;
}

export interface LocationInfo {
  pincode: string;
  area: string;
  city: string;
  etaMinutes: number;
  deliveryFeePaise: number;
  serviceable: boolean;
  label?: string;
}

export interface Order {
  id: string;
  sessionKey: string;
  status: OrderStatus;
  items: OrderItem[];
  breakdown: PricingBreakdown;
  location: LocationInfo;
  appliedPromos: string[];
  note?: string;
  deliverySlot?: 'asap' | 'evening' | 'tomorrow';
  razorpayOrderId: string;
  razorpayKeyId: string;
  paymentSessionToken: string;
  paymentSessionTokenValid: boolean;
  paymentStatus: 'pending' | 'captured' | 'failed';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface SystemEvent {
  id: string;
  timestamp: string;
  type:
    | 'request'
    | 'order_transition'
    | 'webhook_received'
    | 'promo_rejected'
    | 'spec_changed'
    | 'admin_reset';
  description: string;
  details?: Record<string, unknown>;
}

export interface AdminCounts {
  products: number;
  ordersTotal: number;
  ordersPending: number;
  ordersPaid: number;
  ordersFulfilled: number;
  ordersFailed: number;
  ordersExpired: number;
  activeSessions: number;
  processedWebhooks: number;
}

export interface AdminState {
  specVersion: 'v1' | 'v2' | 'v3' | 'v4';
  counts: AdminCounts;
  recentEvents: SystemEvent[];
  orders: Order[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePaise: number;
  mrpPaise: number;
  unit: string;
  inStock: boolean;
  stock?: number;
  maxPerOrder: number;
  tags: string[];
}

export interface HealthStatus {
  status: string;
  uptimeSeconds: number;
  specVersion: string;
  version: string;
}
