// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccessToken = vi.fn<() => Promise<string | null>>();
let transportOptions: {
  prepareSendMessagesRequest: (o: { messages: unknown[] }) => Promise<{
    headers: Record<string, string>;
  }>;
};

vi.mock('ai', () => ({
  DefaultChatTransport: vi.fn(function (this: unknown, options: never) {
    transportOptions = options;
  }),
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    stop: vi.fn(),
    status: 'ready',
    error: undefined,
    setMessages: vi.fn(),
  }),
}));

vi.mock('@donotdev/core', () => ({
  FEATURE_STATUS: { READY: 'ready' },
  FRAMEWORK_FEATURES: { AI: 'ai' },
  getProvider: () => ({ getAccessToken }),
  isClient: () => true,
  useFeatureConsent: () => true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../useAICost', () => ({
  useAICost: () => ({ recordUsage: vi.fn() }),
}));

import { useAIChat } from '../useAIChat';

const authState = {
  user: { id: 'u1' },
  status: 'ready',
} as never;

describe('useAIChat auth header', () => {
  beforeEach(() => {
    getAccessToken.mockReset();
  });

  // Regression: the header read a non-existent user.accessToken and was always `Bearer `.
  it('sends the provider access token fetched at request time', async () => {
    getAccessToken.mockResolvedValue('tok-123');
    renderHook(() => useAIChat(authState));

    const req = await transportOptions.prepareSendMessagesRequest({
      messages: [],
    });

    expect(req.headers).toEqual({ Authorization: 'Bearer tok-123' });
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('refuses to send without a token', async () => {
    getAccessToken.mockResolvedValue(null);
    renderHook(() => useAIChat(authState));

    await expect(
      transportOptions.prepareSendMessagesRequest({ messages: [] })
    ).rejects.toThrow('errors.unauthenticated');
  });
});
