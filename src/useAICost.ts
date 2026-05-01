'use client';
// packages/features/ai/src/useAICost.ts

/**
 * @fileoverview useAICost - Real-time cost tracking hook
 * @description Tracks cumulative AI cost across a conversation session.
 * Uses token pricing table and markup multiplier.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { useState, useCallback } from 'react';

import type { AICostResult, AIUsage } from '@donotdev/core';

import { calculateCost, mergeCosts, formatCost, EMPTY_COST } from './cost';

// =============================================================================
// Types
// =============================================================================

export interface UseAICostConfig {
  /** Markup multiplier (default: 4.0) */
  markup?: number;
}

export interface UseAICostReturn {
  /** Cost of last request */
  lastCost: AICostResult | null;
  /** Cumulative session cost */
  sessionCost: AICostResult;
  /** Formatted provider cost (e.g., "$0.0032") */
  formattedCost: string;
  /** Formatted billed cost (e.g., "$0.013") */
  formattedBilledCost: string;
  /** Record usage from a completed request */
  recordUsage: (usage: AIUsage, model: string) => void;
  /** Reset session cost */
  reset: () => void;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Track cumulative AI cost across a conversation session.
 *
 * @param config - Cost configuration
 * @returns Cost tracking state and actions
 *
 * @example
 * ```typescript
 * const cost = useAICost({ markup: 4.0 });
 * // After each AI response:
 * cost.recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }, 'claude-sonnet-4-20250514');
 * // Display:
 * console.log(cost.formattedCost);       // "$0.0020"
 * console.log(cost.formattedBilledCost); // "$0.0080"
 * ```
 */
export function useAICost(config?: UseAICostConfig): UseAICostReturn {
  const markup = config?.markup ?? 4.0;

  const [lastCost, setLastCost] = useState<AICostResult | null>(null);
  const [sessionCost, setSessionCost] = useState<AICostResult>(EMPTY_COST);

  const recordUsage = useCallback(
    (usage: AIUsage, model: string) => {
      try {
        const cost = calculateCost(usage, model, markup);
        setLastCost(cost);
        setSessionCost((prev) => mergeCosts(prev, cost));
      } catch (e) {
        // Unknown model - server-side cost tracking is the SSOT
        console.warn(
          '[useAICost] Cost calculation failed for model:',
          model,
          e
        );
      }
    },
    [markup]
  );

  const reset = useCallback(() => {
    setLastCost(null);
    setSessionCost(EMPTY_COST);
  }, []);

  return {
    lastCost,
    sessionCost,
    formattedCost: formatCost(sessionCost.providerCost),
    formattedBilledCost: formatCost(sessionCost.billedCost),
    recordUsage,
    reset,
  };
}
