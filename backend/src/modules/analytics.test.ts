import { describe, expect, it } from 'vitest';
import { calculateKpis } from './analytics.js';

describe('analytics KPI calculations', () => {
  it('calculates normalized KPI values from reported metrics', () => {
    const result = calculateKpis({ impressions: 10000, clicks: 500, spend: 1000, conversions: 50, revenue: 3000 });
    expect(result.cpm).toBe(100);
    expect(result.ctr).toBe(5);
    expect(result.cpc).toBe(2);
    expect(result.conversionRate).toBe(10);
    expect(result.cpa).toBe(20);
    expect(result.roas).toBe(3);
  });

  it('preserves unknown metrics instead of treating them as zero', () => {
    const result = calculateKpis({ impressions: 0, clicks: null, spend: 100, conversions: null, revenue: null });
    expect(result.cpm).toBe(null);
    expect(result.ctr).toBe(null);
    expect(result.cpc).toBe(null);
    expect(result.conversionRate).toBe(null);
    expect(result.cpa).toBe(null);
    expect(result.roas).toBe(null);
  });

  it('does not invent a ROAS when spend is zero', () => {
    const result = calculateKpis({ impressions: 1000, clicks: 10, spend: 0, conversions: 1, revenue: 100 });
    expect(result.roas).toBe(null);
  });
});
