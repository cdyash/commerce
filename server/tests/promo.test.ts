import { validateAndApplyPromo } from '../src/domain/promo.js';
import { PromoEntry } from '../src/store/seedLoader.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Promo Rules & Conflicts Engine', () => {
  const promosMap = new Map<string, PromoEntry>([
    [
      'WELCOME10',
      {
        code: 'WELCOME10',
        description: '10% off up to ₹100',
        discountType: 'percentage',
        value: 10,
        minSubtotalPaise: 19900,
        maxDiscountPaise: 10000,
        firstOrderOnly: true,
        exclusiveGroup: 'order_discount',
        active: true,
      },
    ],
    [
      'FLAT50',
      {
        code: 'FLAT50',
        description: 'Flat ₹50 off',
        discountType: 'flat',
        value: 5000,
        minSubtotalPaise: 49900,
        maxDiscountPaise: 5000,
        firstOrderOnly: false,
        exclusiveGroup: 'order_discount',
        active: true,
      },
    ],
    [
      'FREEDEL',
      {
        code: 'FREEDEL',
        description: 'Free delivery',
        discountType: 'free_delivery',
        value: 0,
        minSubtotalPaise: 14900,
        firstOrderOnly: false,
        active: true,
      },
    ],
    [
      'EXPIRED20',
      {
        code: 'EXPIRED20',
        description: 'Expired code',
        discountType: 'percentage',
        value: 20,
        minSubtotalPaise: 10000,
        firstOrderOnly: false,
        active: false,
        expired: true,
      },
    ],
  ]);

  test('Unknown promo code throws 404 PROMO_NOT_FOUND', () => {
    expect(() =>
      validateAndApplyPromo({
        code: 'NONEXISTENT',
        subtotalPaise: 30000,
        currentAppliedCodes: [],
        promosMap,
        isFirstOrder: true,
      })
    ).toThrow(AppError);

    try {
      validateAndApplyPromo({
        code: 'NONEXISTENT',
        subtotalPaise: 30000,
        currentAppliedCodes: [],
        promosMap,
        isFirstOrder: true,
      });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(404);
      expect(appErr.code).toBe('PROMO_NOT_FOUND');
    }
  });

  test('Expired promo code throws 410 PROMO_EXPIRED', () => {
    try {
      validateAndApplyPromo({
        code: 'EXPIRED20',
        subtotalPaise: 30000,
        currentAppliedCodes: [],
        promosMap,
        isFirstOrder: true,
      });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(410);
      expect(appErr.code).toBe('PROMO_EXPIRED');
    }
  });

  test('Below minimum subtotal throws 422 PROMO_MIN_NOT_MET', () => {
    try {
      validateAndApplyPromo({
        code: 'WELCOME10',
        subtotalPaise: 10000, // < 19900 required
        currentAppliedCodes: [],
        promosMap,
        isFirstOrder: true,
      });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(422);
      expect(appErr.code).toBe('PROMO_MIN_NOT_MET');
    }
  });

  test('WELCOME10 fails on subsequent order with 422 PROMO_FIRST_ORDER_ONLY', () => {
    try {
      validateAndApplyPromo({
        code: 'WELCOME10',
        subtotalPaise: 25000,
        currentAppliedCodes: [],
        promosMap,
        isFirstOrder: false,
      });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(422);
      expect(appErr.code).toBe('PROMO_FIRST_ORDER_ONLY');
    }
  });

  test('Applying WELCOME10 then FLAT50 throws 409 PROMO_CONFLICT', () => {
    try {
      validateAndApplyPromo({
        code: 'FLAT50',
        subtotalPaise: 60000,
        currentAppliedCodes: ['WELCOME10'],
        promosMap,
        isFirstOrder: true,
      });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe('PROMO_CONFLICT');
      expect((appErr.details as { conflictingCode: string }).conflictingCode).toBe('WELCOME10');
    }
  });

  test('FREEDEL stacks with WELCOME10 successfully', () => {
    const result = validateAndApplyPromo({
      code: 'FREEDEL',
      subtotalPaise: 25000,
      currentAppliedCodes: ['WELCOME10'],
      promosMap,
      isFirstOrder: true,
    });

    expect(result.updatedAppliedCodes).toEqual(['WELCOME10', 'FREEDEL']);
  });

  test('Re-applying an already applied promo is an idempotent no-op', () => {
    const result = validateAndApplyPromo({
      code: 'WELCOME10',
      subtotalPaise: 25000,
      currentAppliedCodes: ['WELCOME10'],
      promosMap,
      isFirstOrder: true,
    });

    expect(result.isAlreadyApplied).toBe(true);
    expect(result.updatedAppliedCodes).toEqual(['WELCOME10']);
  });
});

