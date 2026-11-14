import { PricingBreakdown } from '../store/memoryStore.js';
import { PromoEntry } from '../store/seedLoader.js';

export interface PricingItem {
  pricePaise: number;
  quantity: number;
}

export interface PricingOptions {
  items: PricingItem[];
  appliedPromos?: string[];
  promosMap: Map<string, PromoEntry>;
  locationDeliveryFeePaise?: number;
  isFirstOrder?: boolean;
}

export interface CalculatedPricing {
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  gstPaise: number;
  totalPaise: number;
  breakdown: PricingBreakdown;
  activePromoCodes: string[];
}

export const HANDLING_FEE_PAISE = 500; // 500 paise flat handling fee
export const FREE_DELIVERY_THRESHOLD_PAISE = 49900; // Free delivery threshold

/**
 * Pure pricing calculator.
 * All amounts are in integer paise. Floats are never used.
 */
export function calculatePricing(options: PricingOptions): CalculatedPricing {
  const {
    items,
    appliedPromos = [],
    promosMap,
    locationDeliveryFeePaise = 0,
    isFirstOrder = true,
  } = options;

  // 1. Subtotal = sum(price * qty)
  const subtotalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);

  // 2. Evaluate promos & discount
  let discountPaise = 0;
  let hasFreeDeliveryPromo = false;
  const activePromoCodes: string[] = [];

  for (const code of appliedPromos) {
    const promo = promosMap.get(code);
    if (!promo || promo.expired || !promo.active) {
      continue;
    }

    if (promo.minSubtotalPaise && subtotalPaise < promo.minSubtotalPaise) {
      continue;
    }

    if (promo.firstOrderOnly && !isFirstOrder) {
      continue;
    }

    if (promo.code === 'WELCOME10') {
      const tenPercent = Math.round(subtotalPaise * 0.1);
      const capped = Math.min(tenPercent, promo.maxDiscountPaise ?? 10000);
      discountPaise += capped;
      activePromoCodes.push(promo.code);
    } else if (promo.code === 'FLAT50') {
      discountPaise += promo.value; // 5000 paise
      activePromoCodes.push(promo.code);
    } else if (promo.code === 'FREEDEL') {
      hasFreeDeliveryPromo = true;
      activePromoCodes.push(promo.code);
    }
  }

  // Discount cannot exceed subtotal
  discountPaise = Math.min(discountPaise, subtotalPaise);

  // 3. Delivery Fee: waived if subtotal >= 49900 or FREEDEL promo
  let deliveryFeePaise = locationDeliveryFeePaise;
  if (subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE || hasFreeDeliveryPromo || subtotalPaise === 0) {
    deliveryFeePaise = 0;
  }

  // 4. Handling fee: 500 paise (0 if cart is empty)
  const handlingFeePaise = subtotalPaise > 0 ? HANDLING_FEE_PAISE : 0;

  // 5. GST: 5% on (subtotal - discount), rounded half-up
  const taxableBase = Math.max(0, subtotalPaise - discountPaise);
  const gstPaise = subtotalPaise > 0 ? Math.round(taxableBase * 0.05) : 0;

  // 6. Total = subtotal - discount + deliveryFee + handlingFee + gst
  const totalPaise = taxableBase + deliveryFeePaise + handlingFeePaise + gstPaise;

  const breakdown: PricingBreakdown = {
    subtotalPaise,
    discountPaise,
    deliveryFeePaise,
    handlingFeePaise,
    gstPaise,
    totalPaise,
  };

  return {
    subtotalPaise,
    discountPaise,
    deliveryFeePaise,
    handlingFeePaise,
    gstPaise,
    totalPaise,
    breakdown,
    activePromoCodes,
  };
}

