'use client';
// packages/features/ai/src/useAI.ts

/**
 * @fileoverview useAI - Property-based access hook for AI operations
 * @description Single entry point for AI chat. Mirrors useStripeBilling pattern.
 * Wraps useAIChat internally, exposes property-based access for consumers.
 *
 * @usage
 * ```typescript
 * const authState = useAIAuth();
 * const append = useAI('append', authState);
 * const messages = useAI('messages', authState);
 * const isLoading = useAI('isLoading', authState);
 * const cost = useAI('cost', authState);
 * ```
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import type { AIAPI } from '@donotdev/core';
import { DEGRADED_AI_API, isClient } from '@donotdev/core';

import type { AIAuthState } from './useAIAuth';
import type { UseAIChatConfig } from './useAIChat';
import { useAIChat } from './useAIChat';

/**
 * React hook for AI operations with property-based access.
 * Mirrors useStripeBilling pattern exactly.
 *
 * @template K - The property key from AIAPI
 * @param key - Property name to access
 * @param authState - Auth state from useAIAuth hook
 * @param config - Optional AI chat configuration
 * @returns The value of the specified property
 *
 * @example
 * ```typescript
 * const authState = useAIAuth();
 * const messages = useAI('messages', authState);
 * const append = useAI('append', authState);
 * const isLoading = useAI('isLoading', authState);
 * const stop = useAI('stop', authState);
 * const cost = useAI('cost', authState);
 * ```
 */
export function useAI<K extends keyof AIAPI>(
  key: K,
  authState?: AIAuthState,
  config?: UseAIChatConfig
): AIAPI[K] {
  const chatState = useAIChat(
    authState ?? { user: null, status: 'degraded' as const },
    config
  );

  if (!isClient()) {
    return DEGRADED_AI_API[key];
  }

  const api: AIAPI = {
    messages: chatState.messages,
    append: chatState.append,
    stop: chatState.stop,
    isLoading: chatState.isLoading,
    error: chatState.error,
    clearMessages: chatState.clearMessages,
    isAvailable: chatState.isAvailable,
    input: chatState.input,
    setInput: chatState.setInput,
    handleSubmit: chatState.handleSubmit,
    cost: chatState.cost,
    toolCalls: chatState.toolCalls,
  };

  return api[key];
}
