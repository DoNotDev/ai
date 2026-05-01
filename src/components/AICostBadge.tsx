'use client';
// packages/features/ai/src/components/AICostBadge.tsx

/**
 * @fileoverview AICostBadge - Cost display for SaaS owners / admin dashboards
 * @description Shows billed cost (with markup) only. Provider cost is NEVER exposed client-side.
 * Consumer/SaaS owner uses this in admin views to show what users are being charged.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { Badge, Stack, Text } from '@donotdev/components';
import { useTranslation } from '@donotdev/core';
import type { AICostResult } from '@donotdev/core';

export interface AICostBadgeProps {
  /** Session cost data */
  sessionCost: AICostResult;
  /** Formatted billed cost string (with markup applied) */
  formattedBilledCost: string;
  /** Custom className */
  className?: string;
}

/**
 * Cost display badge for admin/SaaS-owner views.
 * Shows billed cost only - provider cost is never exposed to client.
 *
 * @example
 * ```tsx
 * <AICostBadge
 *   sessionCost={cost.sessionCost}
 *   formattedBilledCost={cost.formattedBilledCost}
 * />
 * ```
 */
export function AICostBadge({
  sessionCost,
  formattedBilledCost,
  className,
}: AICostBadgeProps) {
  const { t } = useTranslation('ai');

  if (
    sessionCost.breakdown.promptTokens === 0 &&
    sessionCost.breakdown.completionTokens === 0
  ) {
    return null;
  }

  const totalTokens =
    sessionCost.breakdown.promptTokens + sessionCost.breakdown.completionTokens;

  return (
    <Stack direction="row" gap="tight" align="center" className={className}>
      <Badge variant="outline">{formattedBilledCost}</Badge>
      <Text variant="muted" level="caption">
        {totalTokens.toLocaleString()} {t('cost.tokens')}
      </Text>
    </Stack>
  );
}
