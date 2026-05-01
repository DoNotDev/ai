import { describe, it, expect } from 'vitest';

import {
  calculateCost,
  mergeCosts,
  formatCost,
  EMPTY_COST,
} from '../costCalculator';

describe('calculateCost', () => {
  it('calculates cost for claude-sonnet-4 correctly', () => {
    const result = calculateCost(
      {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        totalTokens: 2_000_000,
      },
      'claude-sonnet-4-20250514',
      4.0
    );

    // $3.00 prompt + $15.00 completion = $18.00 provider cost
    expect(result.providerCost).toBeCloseTo(18.0);
    // $18.00 * 4 = $72.00 billed cost
    expect(result.billedCost).toBeCloseTo(72.0);
    expect(result.markup).toBe(4.0);
    expect(result.breakdown.promptTokens).toBe(1_000_000);
    expect(result.breakdown.completionTokens).toBe(1_000_000);
    expect(result.breakdown.promptCost).toBeCloseTo(3.0);
    expect(result.breakdown.completionCost).toBeCloseTo(15.0);
  });

  it('calculates cost for small token counts', () => {
    const result = calculateCost(
      { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
      'gpt-4o-mini',
      4.0
    );

    // 500/1M * $0.15 = $0.000075 prompt
    // 200/1M * $0.60 = $0.00012 completion
    // total = $0.000195 provider
    expect(result.providerCost).toBeCloseTo(0.000195);
    expect(result.billedCost).toBeCloseTo(0.00078);
  });

  it('applies custom markup', () => {
    const result = calculateCost(
      { promptTokens: 1_000_000, completionTokens: 0, totalTokens: 1_000_000 },
      'gemini-2.0-flash',
      10.0
    );

    // $0.10 provider * 10 = $1.00 billed
    expect(result.providerCost).toBeCloseTo(0.1);
    expect(result.billedCost).toBeCloseTo(1.0);
    expect(result.markup).toBe(10.0);
  });

  it('handles zero tokens', () => {
    const result = calculateCost(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      'gpt-4o'
    );

    expect(result.providerCost).toBe(0);
    expect(result.billedCost).toBe(0);
  });

  it('throws for unknown model', () => {
    expect(() =>
      calculateCost(
        { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        'nonexistent-model'
      )
    ).toThrow('Unknown model for cost calculation: nonexistent-model');
  });

  it('uses default markup of 4.0', () => {
    const result = calculateCost(
      { promptTokens: 1_000_000, completionTokens: 0, totalTokens: 1_000_000 },
      'claude-opus-4-20250514'
    );

    // $15.00 * 4 = $60.00
    expect(result.billedCost).toBeCloseTo(60.0);
    expect(result.markup).toBe(4.0);
  });

  it('calculates all supported models without error', () => {
    const models = [
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-20250514',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'o3-mini',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ];

    for (const model of models) {
      const result = calculateCost(
        { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
        model
      );
      expect(result.providerCost).toBeGreaterThanOrEqual(0);
      expect(result.billedCost).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('mergeCosts', () => {
  it('merges two cost results correctly', () => {
    const a = calculateCost(
      { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      'gpt-4o',
      4.0
    );
    const b = calculateCost(
      { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      'gpt-4o',
      4.0
    );

    const merged = mergeCosts(a, b);

    expect(merged.breakdown.promptTokens).toBe(300);
    expect(merged.breakdown.completionTokens).toBe(150);
    expect(merged.providerCost).toBeCloseTo(a.providerCost + b.providerCost);
    expect(merged.billedCost).toBeCloseTo(a.billedCost + b.billedCost);
    expect(merged.markup).toBe(4.0);
  });

  it('uses latest markup from second operand', () => {
    const a = calculateCost(
      { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      'gpt-4o',
      2.0
    );
    const b = calculateCost(
      { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      'gpt-4o',
      6.0
    );

    const merged = mergeCosts(a, b);
    expect(merged.markup).toBe(6.0);
  });

  it('merges with EMPTY_COST', () => {
    const cost = calculateCost(
      { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
      'gpt-4o'
    );

    const merged = mergeCosts(EMPTY_COST, cost);
    expect(merged.providerCost).toBeCloseTo(cost.providerCost);
    expect(merged.billedCost).toBeCloseTo(cost.billedCost);
  });
});

describe('formatCost', () => {
  it('formats zero', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('formats small amounts with 4 decimals', () => {
    expect(formatCost(0.0032)).toBe('$0.0032');
    expect(formatCost(0.001)).toBe('$0.0010');
  });

  it('formats regular amounts with 2 decimals', () => {
    expect(formatCost(1.5)).toBe('$1.50');
    expect(formatCost(72.0)).toBe('$72.00');
  });

  it('formats edge case at $0.01 boundary', () => {
    expect(formatCost(0.009)).toBe('$0.0090');
    expect(formatCost(0.01)).toBe('$0.01');
    expect(formatCost(0.011)).toBe('$0.01');
  });
});

describe('EMPTY_COST', () => {
  it('has all zero values', () => {
    expect(EMPTY_COST.providerCost).toBe(0);
    expect(EMPTY_COST.billedCost).toBe(0);
    expect(EMPTY_COST.markup).toBe(4.0);
    expect(EMPTY_COST.breakdown.promptTokens).toBe(0);
    expect(EMPTY_COST.breakdown.completionTokens).toBe(0);
    expect(EMPTY_COST.breakdown.promptCost).toBe(0);
    expect(EMPTY_COST.breakdown.completionCost).toBe(0);
  });
});
