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
import type { AuthAPI, AuthUser, FeatureStatus } from '@donotdev/core';
import { FEATURE_STATUS } from '@donotdev/core';

// why: @donotdev/auth is an optional peer — the bundler aliases it to an empty module when absent
const realUseAuth = authModule?.useAuth as
  | (<K extends keyof AuthAPI>(key: K) => AuthAPI[K])
  | undefined;

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
