'use client';
// packages/features/ai/src/useAIChat.ts

/**
 * @fileoverview useAIChat - Chat hook wrapping Vercel AI SDK useChat
 * @description Drop-in chat hook with auth gate, feature consent, and cost tracking.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { useCallback, useMemo } from 'react';

import { useChat } from 'ai/react';
import type { Message } from 'ai';

import type {
  AICostResult,
  AIToolCall,
  AIToolDefinition,
} from '@donotdev/core';
import {
  FEATURE_STATUS,
  FRAMEWORK_FEATURES,
  isClient,
  useFeatureConsent,
  useTranslation,
} from '@donotdev/core';

import type { AIAuthState } from './useAIAuth';
import { useAICost } from './useAICost';

// =============================================================================
// Types
// =============================================================================

export interface UseAIChatConfig {
  /** API endpoint for chat (default: '/api/ai/chat') */
  api?: string;
  /** System prompt prepended to conversation */
  systemPrompt?: string;
  /** AI provider */
  provider?: string;
  /** Model ID */
  model?: string;
  /** Max output tokens */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
  /** Cost markup multiplier (default: 4.0) */
  markup?: number;
  /** Callback on each response with usage data */
  onUsage?: (usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Tool definitions to send with requests */
  tools?: Record<string, AIToolDefinition>;
}

export interface UseAIChatReturn {
  /** Conversation messages */
  messages: Message[];
  /** Send a message */
  append: (content: string) => void;
  /** Stop current stream */
  stop: () => void;
  /** Whether a response is streaming */
  isLoading: boolean;
  /** Current error */
  error: Error | undefined;
  /** Clear conversation */
  clearMessages: () => void;
  /** Whether AI is available (auth + consent) */
  isAvailable: boolean;
  /** Current input value (controlled) */
  input: string;
  /** Set input value */
  setInput: (value: string) => void;
  /** Submit the current input */
  handleSubmit: (e?: React.FormEvent) => void;
  /** Cost tracking (billed cost only - provider cost is server-side only) */
  cost: {
    lastCost: AICostResult | null;
    sessionCost: AICostResult;
    formattedBilledCost: string;
  };
  /** Tool calls from the latest assistant message */
  toolCalls: AIToolCall[];
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Chat hook wrapping Vercel AI SDK useChat.
 * Adds auth gate, feature consent, and real-time cost tracking.
 *
 * @param authState - Auth state from useAIAuth
 * @param config - Chat configuration
 * @returns Chat state and actions
 *
 * @example
 * ```typescript
 * const authState = useAIAuth();
 * const { messages, append, stop, isLoading, cost } = useAIChat(authState, {
 *   provider: 'anthropic',
 *   model: 'claude-sonnet-4-20250514',
 * });
 * ```
 */
export function useAIChat(
  authState: AIAuthState,
  config?: UseAIChatConfig
): UseAIChatReturn {
  const user = authState.user;
  const authReady = authState.status === FEATURE_STATUS.READY;
  const canProceed = useFeatureConsent(FRAMEWORK_FEATURES.AI);
  const { t } = useTranslation('ai');

  const isAvailable = isClient() && authReady && !!user && canProceed;

  const costTracking = useAICost({ markup: config?.markup });

  const {
    messages,
    append: sdkAppend,
    stop,
    isLoading,
    error,
    setMessages,
    input,
    setInput,
    handleSubmit: sdkHandleSubmit,
  } = useChat({
    api: config?.api || '/api/ai/chat',
    headers: useMemo(
      () => ({
        Authorization: user ? `Bearer ${(user as any).accessToken || ''}` : '',
      }),
      [user]
    ),
    body: useMemo(
      () => ({
        provider: config?.provider,
        model: config?.model,
        maxTokens: config?.maxTokens,
        temperature: config?.temperature,
        systemPrompt: config?.systemPrompt,
        tools: config?.tools,
      }),
      [
        config?.provider,
        config?.model,
        config?.maxTokens,
        config?.temperature,
        config?.systemPrompt,
        config?.tools,
      ]
    ),
    onFinish: (_message: any, options: { usage: any }) => {
      if (options.usage) {
        const usageData = {
          promptTokens: options.usage.promptTokens,
          completionTokens: options.usage.completionTokens,
          totalTokens:
            options.usage.promptTokens + options.usage.completionTokens,
        };
        costTracking.recordUsage(
          usageData,
          config?.model || 'claude-sonnet-4-20250514'
        );
        config?.onUsage?.(usageData);
      }
    },
    onError: (err: Error) => {
      config?.onError?.(err);
    },
  });

  const append = useCallback(
    (content: string) => {
      if (!isAvailable) {
        config?.onError?.(new Error(t('errors.not_available')));
        return;
      }
      sdkAppend({ role: 'user', content });
    },
    [isAvailable, sdkAppend, config, t]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    costTracking.reset();
  }, [setMessages, costTracking]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (!isAvailable) {
        e?.preventDefault();
        config?.onError?.(new Error(t('errors.not_available')));
        return;
      }
      sdkHandleSubmit(e);
    },
    [isAvailable, sdkHandleSubmit, config, t]
  );

  // Extract tool calls from the latest assistant message's toolInvocations
  const toolCalls: AIToolCall[] = useMemo(() => {
    if (messages.length === 0) return [];
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return [];

    const invocations = (lastMsg as any).toolInvocations;
    if (!Array.isArray(invocations)) return [];

    return invocations.map((inv: any) => ({
      id: inv.toolCallId || inv.id || '',
      name: inv.toolName || inv.name || '',
      args: inv.args || {},
    }));
  }, [messages]);

  return {
    messages,
    append,
    stop,
    isLoading,
    error,
    clearMessages,
    isAvailable,
    input,
    setInput,
    handleSubmit,
    cost: {
      lastCost: costTracking.lastCost,
      sessionCost: costTracking.sessionCost,
      formattedBilledCost: costTracking.formattedBilledCost,
    },
    toolCalls,
  };
}
