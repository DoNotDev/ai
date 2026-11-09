'use client';
// packages/features/ai/src/useAIAuth.ts

/**
 * @fileoverview useAIAuth - Safe auth state getter for AI feature
 * @description Mirrors useBillingAuth pattern. Sync import of auth, degraded fallback.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import * as authModule from '@donotdev/auth';
import type { AuthUser, FeatureStatus } from '@donotdev/core';
import { FEATURE_STATUS } from '@donotdev/core';

const realUseAuth = (authModule as any)?.useAuth;

/** Auth state for AI feature */
export interface AIAuthState {
  user: AuthUser | null;
  status: FeatureStatus;
}

/**
 * Get auth state for AI feature.
 * Safe to call even if @donotdev/auth is not installed.
 */
export function useAIAuth(): AIAuthState {
  if (realUseAuth) {
    return {
      user: realUseAuth('user'),
      status: realUseAuth('status'),
    };
  }
  return {
    user: null,
    status: FEATURE_STATUS.DEGRADED,
  };
}
