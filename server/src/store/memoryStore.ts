import {
  Product,
  PromoEntry,
  PincodeEntry,
  loadSeedData,
  SeedData,
} from './seedLoader.js';
import { eventLog } from './eventLog.js';

export type SpecVersion = 'v1' | 'v2' | 'v3' | 'v4';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'EXPIRED'
  | 'FULFILLED';

export interface CartItem {
  productId: string;
  quantity: number;
  substituteAllowed?: boolean;
}

export interface SessionCart {
  items: CartItem[];
  appliedPromos: string[];
}

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

export interface Order {
  id: string;
  sessionKey: string;
  status: OrderStatus;
  items: OrderItem[];
  breakdown: PricingBreakdown;
  location: PincodeEntry & { label?: string };
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
  paidAt?: string;
}

export interface SessionLocation extends PincodeEntry {
  label?: string;
  serviceable: true;
}

export interface IdempotencyRecord {
  requestPayloadHash: string;
  orderId: string;
  responseBody: unknown;
}

export class MemoryStore {
  private initialSeed: SeedData;
  public products: Map<string, Product> = new Map();
  public promos: Map<string, PromoEntry> = new Map();
  public pincodes: Map<string, PincodeEntry> = new Map();

  // State maps
  public locations: Map<string, SessionLocation> = new Map(); // sessionKey -> SessionLocation
  public carts: Map<string, SessionCart> = new Map(); // sessionKey -> SessionCart
  public orders: Map<string, Order> = new Map(); // orderId -> Order
  public idempotencyKeys: Map<string, IdempotencyRecord> = new Map(); // sessionKey:key -> Record
  public processedWebhookEvents: Set<string> = new Set();
  public specVersion: SpecVersion = 'v1';

  constructor() {
    this.initialSeed = loadSeedData();
    this.reset();
  }

  public reset(): void {
    // Reload seed deep copies
    this.products.clear();
    for (const p of this.initialSeed.products) {
      this.products.set(p.id, { ...p, tags: [...p.tags] });
    }

    this.promos.clear();
    for (const pr of this.initialSeed.promos) {
      this.promos.set(pr.code, { ...pr });
    }

    this.pincodes.clear();
    for (const pc of this.initialSeed.pincodes) {
      this.pincodes.set(pc.pincode, { ...pc });
    }

    this.locations.clear();
    this.carts.clear();
    this.orders.clear();
    this.idempotencyKeys.clear();
    this.processedWebhookEvents.clear();
    this.specVersion = 'v1';

    eventLog.clear();
    eventLog.record('admin_reset', 'Store reset to initial seeded state (v1).');
  }

  public getCart(sessionKey: string): SessionCart {
    let cart = this.carts.get(sessionKey);
    if (!cart) {
      cart = { items: [], appliedPromos: [] };
      this.carts.set(sessionKey, cart);
    }
    return cart;
  }

  public clearCart(sessionKey: string): void {
    this.carts.set(sessionKey, { items: [], appliedPromos: [] });
  }

  public getSessionOrders(sessionKey: string): Order[] {
    const list: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.sessionKey === sessionKey) {
        list.push(order);
      }
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const store = new MemoryStore();

