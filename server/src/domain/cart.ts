import { Product, PromoEntry } from '../store/seedLoader.js';
import { SessionCart, SessionLocation, PricingBreakdown, SpecVersion, store } from '../store/memoryStore.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculatePricing } from './pricing.js';

export interface CartResponseItem {
  productId: string;
  name: string;
  category: string;
  unit: string;
  pricePaise: number;
  quantity: number;
  totalPaise: number;
  substituteAllowed?: boolean;
}

export interface FullCartResponse {
  items: CartResponseItem[];
  appliedPromos: string[];
  breakdown: PricingBreakdown;
  deliveryLocation: SessionLocation | null;
}

export interface UpdateCartItemOptions {
  cart: SessionCart;
  productId: string;
  quantity: number;
  substituteAllowed?: boolean;
  productsMap: Map<string, Product>;
  promosMap: Map<string, PromoEntry>;
  location?: SessionLocation | null;
  isFirstOrder?: boolean;
  specVersion?: SpecVersion;
}

export function updateCartItem(options: UpdateCartItemOptions): FullCartResponse {
  const {
    cart,
    productId,
    quantity,
    substituteAllowed,
    productsMap,
    promosMap,
    location,
    isFirstOrder = true,
    specVersion = store.specVersion,
  } = options;

  const product = productsMap.get(productId);
  if (!product) {
    throw new AppError(
      404,
      'PRODUCT_NOT_FOUND',
      `Product with id '${productId}' was not found in catalog.`
    );
  }

  if (quantity < 0) {
    throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be greater than or equal to 0.');
  }

  if (quantity === 0) {
    // Remove item
    cart.items = cart.items.filter((item) => item.productId !== productId);
  } else {
    // Check stock
    if (product.stock <= 0) {
      throw new AppError(
        422,
        'OUT_OF_STOCK',
        `Product '${product.name}' is currently out of stock.`,
        { productId, currentStock: product.stock }
      );
    }

    // Check maxPerOrder
    if (quantity > product.maxPerOrder) {
      throw new AppError(
        422,
        'QUANTITY_EXCEEDS_LIMIT',
        `Cannot add ${quantity} units of '${product.name}'. Maximum allowed per order is ${product.maxPerOrder}.`,
        { productId, requestedQuantity: quantity, maxPerOrder: product.maxPerOrder }
      );
    }

    // Check available stock
    if (quantity > product.stock) {
      throw new AppError(
        422,
        'OUT_OF_STOCK',
        `Cannot add ${quantity} units of '${product.name}'. Only ${product.stock} units available in stock.`,
        { productId, requestedQuantity: quantity, availableStock: product.stock }
      );
    }

    const existingIndex = cart.items.findIndex((item) => item.productId === productId);
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity = quantity;
      if (substituteAllowed !== undefined) {
        cart.items[existingIndex].substituteAllowed = substituteAllowed;
      }
    } else {
      cart.items.push({
        productId,
        quantity,
        substituteAllowed,
      });
    }
  }

  return formatCartResponse(cart, productsMap, promosMap, location, isFirstOrder, specVersion);
}

export function formatCartResponse(
  cart: SessionCart,
  productsMap: Map<string, Product>,
  promosMap: Map<string, PromoEntry>,
  location?: SessionLocation | null,
  isFirstOrder = true,
  specVersion: SpecVersion = store.specVersion
): FullCartResponse {
  const items: CartResponseItem[] = [];
  const pricingItems: { pricePaise: number; quantity: number }[] = [];

  for (const ci of cart.items) {
    const p = productsMap.get(ci.productId);
    if (!p) continue;
    const lineTotal = p.pricePaise * ci.quantity;
    const item: CartResponseItem = {
      productId: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      pricePaise: p.pricePaise,
      quantity: ci.quantity,
      totalPaise: lineTotal,
    };
    // substituteAllowed belongs to v2+ only
    if (specVersion !== 'v1' && ci.substituteAllowed !== undefined) {
      item.substituteAllowed = ci.substituteAllowed;
    }
    items.push(item);
    pricingItems.push({
      pricePaise: p.pricePaise,
      quantity: ci.quantity,
    });
  }

  const pricing = calculatePricing({
    items: pricingItems,
    appliedPromos: cart.appliedPromos,
    promosMap,
    locationDeliveryFeePaise: location ? location.deliveryFeePaise : 0,
    isFirstOrder,
  });

  // Keep applied promos aligned with active promos that still qualify
  cart.appliedPromos = pricing.activePromoCodes;

  return {
    items,
    appliedPromos: cart.appliedPromos,
    breakdown: pricing.breakdown,
    deliveryLocation: location || null,
  };
}
