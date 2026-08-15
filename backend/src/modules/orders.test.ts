import { describe, expect, it } from 'vitest';
import { calculateOrderTotals, calculateProfit } from './orders.js';

describe('phase 7 order economics', () => {
  it('calculates COD order totals without losing the discount', () => {
    expect(calculateOrderTotals([
      { quantity: 2, unitPrice: 1500 },
      { quantity: 1, unitPrice: 800 },
    ], 300, 100, 200)).toEqual({ subtotal: 3800, total: 4000 });
  });

  it('calculates profit and keeps advertising spend in the economics', () => {
    expect(calculateProfit(5000, 1800, 400, 100, 900, 100)).toBe(1700);
  });

  it('makes returned orders use zero actual revenue while preserving the expected case', () => {
    expect(calculateProfit(0, 1800, 400, 100, 900, 100)).toBe(-3300);
    expect(calculateProfit(5000, 1800, 400, 100, 900, 100)).toBe(1700);
  });
});
