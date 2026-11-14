import { PromoEntry } from '../store/seedLoader.js';
import { AppError } from '../middleware/errorHandler.js';

export interface ValidatePromoOptions {
  code: string;
  subtotalPaise: number;
  currentAppliedCodes: string[];
  promosMap: Map<string, PromoEntry>;
  isFirstOrder: boolean;
}

export interface PromoValidationResult {
  code: string;
  isAlreadyApplied: boolean;
  promo: PromoEntry;
  updatedAppliedCodes: string[];
}

export function validateAndApplyPromo(options: ValidatePromoOptions): PromoValidationResult {
  const { code, subtotalPaise, currentAppliedCodes, promosMap, isFirstOrder } = options;
  const normalizedCode = code.trim().toUpperCase();

  const promo = promosMap.get(normalizedCode);
  if (!promo) {
    throw new AppError(
      404,
      'PROMO_NOT_FOUND',
      `Promo code '${normalizedCode}' was not found. Please verify the code and try again.`
    );
  }

  if (promo.expired) {
    throw new AppError(
      410,
      'PROMO_EXPIRED',
      `Promo code '${normalizedCode}' has expired and can no longer be used.`
    );
  }

  // Already applied -> no-op (200)
  if (currentAppliedCodes.includes(normalizedCode)) {
    return {
      code: normalizedCode,
      isAlreadyApplied: true,
      promo,
      updatedAppliedCodes: [...currentAppliedCodes],
    };
  }

  // Check minimum subtotal
  if (promo.minSubtotalPaise && subtotalPaise < promo.minSubtotalPaise) {
    throw new AppError(
      422,
      'PROMO_MIN_NOT_MET',
      `Promo code '${normalizedCode}' requires a minimum subtotal of ₹${(promo.minSubtotalPaise / 100).toFixed(2)}. Current subtotal is ₹${(subtotalPaise / 100).toFixed(2)}.`,
      {
        requiredMinPaise: promo.minSubtotalPaise,
        currentSubtotalPaise: subtotalPaise,
      }
    );
  }

  // First order check
  if (promo.firstOrderOnly && !isFirstOrder) {
    throw new AppError(
      422,
      'PROMO_FIRST_ORDER_ONLY',
      `Promo code '${normalizedCode}' is only valid on the first order for this account.`
    );
  }

  // Check exclusive group conflict
  if (promo.exclusiveGroup) {
    for (const applied of currentAppliedCodes) {
      const existing = promosMap.get(applied);
      if (existing && existing.exclusiveGroup === promo.exclusiveGroup) {
        throw new AppError(
          409,
          'PROMO_CONFLICT',
          `Cannot apply '${normalizedCode}' because conflicting promo '${applied}' is already applied. Only one order-level discount code can be active.`,
          {
            conflictingCode: applied,
            newCode: normalizedCode,
          }
        );
      }
    }
  }

  return {
    code: normalizedCode,
    isAlreadyApplied: false,
    promo,
    updatedAppliedCodes: [...currentAppliedCodes, normalizedCode],
  };
}

