// packages/features/ai/src/cost/costCalculator.ts

/**
 * @fileoverview Cost Calculator (Client-Side)
 * @description Calculate cost from token usage using SSOT pricing from `@donotdev/core`.
 * Apply markup for rebilling display. Provider cost is computed but never exposed to end users.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import type { AICostResult, AIUsage } from '@donotdev/core';
import { AI_TOKEN_PRICING, DEFAULT_AI_MARKUP } from '@donotdev/core';

/**
 * Calculate cost from token usage for a given model.
 *
 * @param usage - Token usage (promptTokens, completionTokens)
 * @param model - Model ID (must exist in AI_TOKEN_PRICING)
 * @param markup - Markup multiplier (default: 4.0)
 * @returns Cost breakdown with provider and billed amounts
 * @throws Error if model is not in pricing table
 */
export function calculateCost(
  usage: AIUsage,
  model: string,
  markup: number = DEFAULT_AI_MARKUP
): AICostResult {
  const pricing = AI_TOKEN_PRICING[model];
  if (!pricing) {
    throw new Error(`Unknown model for cost calculation: ${model}`);
  }

  const promptCost = (usage.promptTokens / 1_000_000) * pricing.promptPer1M;
  const completionCost =
    (usage.completionTokens / 1_000_000) * pricing.completionPer1M;
  const providerCost = promptCost + completionCost;

  return {
    providerCost,
    billedCost: providerCost * markup,
    markup,
    breakdown: {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      promptCost,
      completionCost,
    },
  };
}

/**
 * Merge two cost results (for cumulative tracking).
 */
export function mergeCosts(a: AICostResult, b: AICostResult): AICostResult {
  return {
    providerCost: a.providerCost + b.providerCost,
    billedCost: a.billedCost + b.billedCost,
    markup: b.markup,
    breakdown: {
      promptTokens: a.breakdown.promptTokens + b.breakdown.promptTokens,
      completionTokens:
        a.breakdown.completionTokens + b.breakdown.completionTokens,
      promptCost: a.breakdown.promptCost + b.breakdown.promptCost,
      completionCost: a.breakdown.completionCost + b.breakdown.completionCost,
    },
  };
}

/** Empty cost result for initialization */
export const EMPTY_COST: AICostResult = {
  providerCost: 0,
  billedCost: 0,
  markup: DEFAULT_AI_MARKUP,
  breakdown: {
    promptTokens: 0,
    completionTokens: 0,
    promptCost: 0,
    completionCost: 0,
  },
};

/**
 * Format a USD cost for display (e.g., "$0.0032").
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
