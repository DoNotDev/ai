'use client';
// packages/features/ai/src/components/AIChat.tsx

/**
 * @fileoverview AIChat Component
 * @description Drop-in chat component for AI conversations.
 * Uses useAI property-based access (framework pattern). SaaS owner controls visibility via props.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { useRef, useEffect } from 'react';

import {
  Badge,
  Button,
  Card,
  ScrollArea,
  Separator,
  Stack,
  Text,
  Textarea,
} from '@donotdev/components';
import type { AIUsage } from '@donotdev/core';
import { useTranslation } from '@donotdev/core';

import { useAI } from '../useAI';
import type { UseAIChatConfig } from '../useAIChat';
import { useAIAuth } from '../useAIAuth';
import { AICostBadge } from './AICostBadge';

export interface AIChatProps {
  /** System prompt for the AI */
  systemPrompt?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** AI configuration */
  config?: UseAIChatConfig;
  /** Show token usage after each response (default: false - admin feature) */
  showUsage?: boolean;
  /** Show model/provider badge (default: false - admin feature) */
  showModel?: boolean;
  /** Show cost badge (default: false - admin/SaaS-owner feature) */
  showCost?: boolean;
  /** Show message timestamps (default: false) */
  showTimestamps?: boolean;
  /** Show tool calls below messages (default: false) */
  showToolCalls?: boolean;
  /** Callback when a message is sent or received */
  onMessage?: (role: 'user' | 'assistant', content: string) => void;
  /** Callback with usage data after each response (for SaaS owner tracking) */
  onUsage?: (usage: AIUsage) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Custom className */
  className?: string;
}

/**
 * Drop-in AI chat component with configurable visibility.
 *
 * @example
 * ```tsx
 * // End-user facing - minimal UI
 * <AIChat systemPrompt="You are a helpful assistant." />
 *
 * // Admin facing - full stats
 * <AIChat showUsage showModel showCost showTimestamps />
 * ```
 */
export function AIChat({
  systemPrompt,
  placeholder,
  config,
  showUsage = false,
  showModel = false,
  showCost = false,
  showTimestamps = false,
  showToolCalls = false,
  onMessage,
  onUsage,
  onError,
  className,
}: AIChatProps) {
  const { t } = useTranslation('ai');
  const authState = useAIAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Merge systemPrompt into config
  const mergedConfig: UseAIChatConfig = {
    ...config,
    systemPrompt: systemPrompt || config?.systemPrompt,
    onUsage,
    onError,
  };

  // Property-based access (framework pattern)
  const messages = useAI('messages', authState, mergedConfig);
  const isLoading = useAI('isLoading', authState, mergedConfig);
  const isAvailable = useAI('isAvailable', authState, mergedConfig);
  const error = useAI('error', authState, mergedConfig);
  const input = useAI('input', authState, mergedConfig);
  const setInput = useAI('setInput', authState, mergedConfig);
  const stop = useAI('stop', authState, mergedConfig);
  const handleSubmit = useAI('handleSubmit', authState, mergedConfig);
  const cost = useAI('cost', authState, mergedConfig);
  const toolCalls = useAI('toolCalls', authState, mergedConfig);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Notify parent on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last) {
      onMessage?.(last.role as 'user' | 'assistant', last.content);
    }
  }, [messages.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isAvailable) {
    return (
      <Card className={className}>
        <Text variant="muted">{t('chat.unavailable')}</Text>
      </Card>
    );
  }

  return (
    <Stack direction="column" gap="medium" className={className}>
      {/* Admin bar: model/provider + cost */}
      {(showModel || showCost) && (
        <Stack direction="row" gap="tight" align="center">
          {showModel && config?.provider && (
            <Badge variant="outline">{config.provider}</Badge>
          )}
          {showModel && config?.model && (
            <Badge variant="secondary">{config.model}</Badge>
          )}
          {showCost && (
            <AICostBadge
              sessionCost={cost.sessionCost}
              formattedBilledCost={cost.formattedBilledCost}
            />
          )}
        </Stack>
      )}

      {/* Messages area */}
      <ScrollArea className="dndev-h-[400px]" ref={scrollRef}>
        <Stack direction="column" gap="tight">
          {messages.length === 0 && !isLoading && (
            <Text variant="muted">{t('chat.empty')}</Text>
          )}

          {messages.map((msg) => (
            <Card
              key={msg.id}
              variant={msg.role === 'user' ? 'default' : 'muted'}
            >
              <Stack direction="column" gap="none">
                <Stack direction="row" gap="tight" align="center">
                  <Text variant="secondary" weight="semibold">
                    {msg.role === 'user' ? t('chat.you') : t('chat.assistant')}
                  </Text>
                  {showTimestamps && msg.createdAt && (
                    <Text variant="muted" level="caption">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </Text>
                  )}
                </Stack>
                <Text>{msg.content}</Text>
              </Stack>
            </Card>
          ))}

          {/* Tool calls display */}
          {showToolCalls && toolCalls.length > 0 && (
            <>
              {toolCalls.map((tc) => (
                <Card key={tc.id} variant="outline">
                  <Stack direction="column" gap="none">
                    <Text variant="secondary" weight="semibold" level="caption">
                      {t('chat.tool_call')}: {tc.name}
                    </Text>
                    <Text variant="muted" level="caption">
                      {JSON.stringify(tc.args, null, 2)}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </>
          )}

          {/* Streaming indicator */}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === 'user' && (
              <Card variant="muted">
                <Text variant="muted">{t('chat.thinking')}</Text>
              </Card>
            )}
        </Stack>
      </ScrollArea>

      {/* Usage stats (admin-visible only) */}
      {showUsage && cost.lastCost && !isLoading && (
        <>
          <Separator />
          <Stack direction="row" gap="tight">
            <Text variant="muted" level="caption">
              {t('chat.last_usage')}: {cost.lastCost.breakdown.promptTokens}↑{' '}
              {cost.lastCost.breakdown.completionTokens}↓
            </Text>
          </Stack>
        </>
      )}

      {/* Error display */}
      {error && <Text variant="destructive">{error.message}</Text>}

      {/* Input area */}
      <Stack direction="row" gap="tight" align="end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('chat.placeholder')}
          disabled={isLoading}
          aria-label={t('chat.input_label')}
        />
        {isLoading ? (
          <Button variant="outline" onClick={stop}>
            {t('chat.abort')}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => handleSubmit()}
            disabled={!input.trim()}
          >
            {t('chat.send')}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
