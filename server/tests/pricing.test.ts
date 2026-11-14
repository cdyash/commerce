import { calculatePricing } from '../src/domain/pricing.js';
import { PromoEntry } from '../src/store/seedLoader.js';

describe('Pricing Pure Calculations (Integer Paise)', () => {
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
  ]);

  test('Empty cart results in 0 total and no fees', () => {
    const result = calculatePricing({
      items: [],
      promosMap,
      locationDeliveryFeePaise: 2900,
    });

    expect(result.subtotalPaise).toBe(0);
    expect(result.discountPaise).toBe(0);
    expect(result.deliveryFeePaise).toBe(0);
    expect(result.handlingFeePaise).toBe(0);
    expect(result.gstPaise).toBe(0);
    expect(result.totalPaise).toBe(0);
  });

  test('Cart below free delivery threshold includes delivery and handling fee', () => {
    // 2 items @ 10000 = 20000 paise (₹200)
    // No promo
    // deliveryFee: 2900
    // handlingFee: 500
    // gst: 5% of 20000 = 1000
    // total: 20000 + 2900 + 500 + 1000 = 24400 paise
    const result = calculatePricing({
      items: [{ pricePaise: 10000, quantity: 2 }],
      promosMap,
      locationDeliveryFeePaise: 2900,
    });

    expect(result.subtotalPaise).toBe(20000);
    expect(result.discountPaise).toBe(0);
    expect(result.deliveryFeePaise).toBe(2900);
    expect(result.handlingFeePaise).toBe(500);
    expect(result.gstPaise).toBe(1000);
    expect(result.totalPaise).toBe(24400);
  });

  test('Cart >= 49900 automatically waives delivery fee', () => {
    // 50000 subtotal (>= 49900)
    // deliveryFee should be 0
    // handlingFee: 500
    // gst: 5% of 50000 = 2500
    // total: 50000 + 0 + 500 + 2500 = 53000
    const result = calculatePricing({
      items: [{ pricePaise: 50000, quantity: 1 }],
      promosMap,
      locationDeliveryFeePaise: 3500,
    });

    expect(result.deliveryFeePaise).toBe(0);
    expect(result.totalPaise).toBe(53000);
  });

  test('WELCOME10 caps at 10000 paise (₹100)', () => {
    // Subtotal 150000 paise (₹1500)
    // 10% is 15000 paise, but capped at 10000 paise
    const result = calculatePricing({
      items: [{ pricePaise: 150000, quantity: 1 }],
      appliedPromos: ['WELCOME10'],
      promosMap,
      locationDeliveryFeePaise: 2900,
      isFirstOrder: true,
    });

    expect(result.discountPaise).toBe(10000);
    // Subtotal 150000 >= 49900 so deliveryFee is 0
    expect(result.deliveryFeePaise).toBe(0);
    // taxable = 150000 - 10000 = 140000
    // gst = 140000 * 0.05 = 7000
    // total = 140000 + 0 + 500 + 7000 = 147500
    expect(result.gstPaise).toBe(7000);
    expect(result.totalPaise).toBe(147500);
  });

  test('WELCOME10 is ignored if subtotal is below minSubtotal (19900)', () => {
    const result = calculatePricing({
      items: [{ pricePaise: 15000, quantity: 1 }], // ₹150 < ₹199
      appliedPromos: ['WELCOME10'],
      promosMap,
      locationDeliveryFeePaise: 2900,
      isFirstOrder: true,
    });

    expect(result.discountPaise).toBe(0);
    expect(result.activePromoCodes).not.toContain('WELCOME10');
  });

  test('FREEDEL waives delivery fee when subtotal >= 14900', () => {
    // Subtotal 20000 (< 49900 threshold, so normally delivery fee would apply)
    const result = calculatePricing({
      items: [{ pricePaise: 20000, quantity: 1 }],
      appliedPromos: ['FREEDEL'],
      promosMap,
      locationDeliveryFeePaise: 2900,
    });

    expect(result.deliveryFeePaise).toBe(0);
    expect(result.activePromoCodes).toContain('FREEDEL');
  });

  test('GST rounds half-up properly on fractional paise calculations', () => {
    // Subtotal: 1001 paise. Discount: 0.
    // 5% of 1001 = 50.05 -> rounds to 50
    const res1 = calculatePricing({
      items: [{ pricePaise: 1001, quantity: 1 }],
      promosMap,
      locationDeliveryFeePaise: 0,
    });
    expect(res1.gstPaise).toBe(50);

    // Subtotal: 1010 paise.
    // 5% of 1010 = 50.5 -> rounds to 51
    const res2 = calculatePricing({
      items: [{ pricePaise: 1010, quantity: 1 }],
      promosMap,
      locationDeliveryFeePaise: 0,
    });
    expect(res2.gstPaise).toBe(51);
  });
});

