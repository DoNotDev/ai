'use client';
// packages/features/ai/src/useAIChat.ts

/**
 * @fileoverview useAIChat - Chat hook wrapping Vercel AI SDK 7 useChat
 * @description Drop-in chat hook with auth gate, feature consent, and cost tracking.
 * Exposes framework messages (`AIMessage`, text content) and keeps the input state
 * that AI SDK 5+ no longer manages. Requests use the framework `AIChatRequest`
 * shape; token usage comes back as message metadata (`metadata.usage`).
 *
 * @version 0.2.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  AICostResult,
  AIMessage,
  AIToolCall,
  AIToolDefinition,
  AIUsage,
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

/** Chat message as streamed by the AI route: usage arrives as metadata. */
type ChatUIMessage = UIMessage<{ usage?: AIUsage }>;

/** Text content of a UI message (text parts joined). */
function textOf(message: ChatUIMessage): string {
  return message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}

/** UI message → framework message (role + text content). */
function toAIMessage(message: ChatUIMessage): AIMessage {
  return { id: message.id, role: message.role, content: textOf(message) };
}

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
  /** Conversation messages (text content) */
  messages: AIMessage[];
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

  // Latest auth header and request options, read when each request is sent: the
  // transport is created once, the user and config can change between renders.
  const requestRef = useRef({ authorization: '', options: {} as object });
  requestRef.current = {
    authorization: user ? `Bearer ${(user as any).accessToken || ''}` : '',
    options: {
      provider: config?.provider,
      model: config?.model,
      maxTokens: config?.maxTokens,
      temperature: config?.temperature,
      systemPrompt: config?.systemPrompt,
      tools: config?.tools,
    },
  };

  const api = config?.api || '/api/ai/chat';
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api,
        prepareSendMessagesRequest: ({ messages: uiMessages }) => ({
          headers: { Authorization: requestRef.current.authorization },
          // Framework AIChatRequest: text messages only (tool-only turns carry no text).
          body: {
            ...requestRef.current.options,
            messages: uiMessages
              .map(toAIMessage)
              .filter((m) => m.content.length > 0),
          },
        }),
      }),
    [api]
  );

  const {
    messages: uiMessages,
    sendMessage,
    stop,
    status,
    error,
    setMessages,
  } = useChat<ChatUIMessage>({
    transport,
    onFinish: ({ message }) => {
      const usageData = message.metadata?.usage;
      if (usageData) {
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

  const messages = useMemo(() => uiMessages.map(toAIMessage), [uiMessages]);
  const isLoading = status === 'submitted' || status === 'streaming';
  const [input, setInput] = useState('');

  const append = useCallback(
    (content: string) => {
      if (!isAvailable) {
        config?.onError?.(new Error(t('errors.not_available')));
        return;
      }
      void sendMessage({ text: content });
    },
    [isAvailable, sendMessage, config, t]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    costTracking.reset();
  }, [setMessages, costTracking]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!isAvailable) {
        config?.onError?.(new Error(t('errors.not_available')));
        return;
      }
      const text = input.trim();
      if (!text) return;
      void sendMessage({ text });
      setInput('');
    },
    [isAvailable, input, sendMessage, config, t]
  );

  // Tool calls of the latest assistant message: static parts are `tool-<name>`,
  // dynamic ones `dynamic-tool` (with toolName).
  const toolCalls: AIToolCall[] = useMemo(() => {
    const lastMsg = uiMessages[uiMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return [];

    return lastMsg.parts.flatMap((part): AIToolCall[] => {
      if (part.type === 'dynamic-tool') {
        return [
          {
            id: part.toolCallId,
            name: part.toolName,
            args: (part.input ?? {}) as Record<string, unknown>,
          },
        ];
      }
      if (part.type.startsWith('tool-') && 'toolCallId' in part) {
        return [
          {
            id: part.toolCallId,
            name: part.type.slice('tool-'.length),
            args: (part.input ?? {}) as Record<string, unknown>,
          },
        ];
      }
      return [];
    });
  }, [uiMessages]);

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
