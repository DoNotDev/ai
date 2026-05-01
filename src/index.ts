// packages/features/ai/src/index.ts

// Public API (property-based access - framework pattern)
export { useAI } from './useAI';
export { useAIAuth } from './useAIAuth';
export type { AIAuthState } from './useAIAuth';

// Internal hook (for advanced consumers who want the full object)
export { useAIChat } from './useAIChat';
export type { UseAIChatConfig, UseAIChatReturn } from './useAIChat';

// Cost hook
export { useAICost } from './useAICost';
export type { UseAICostConfig, UseAICostReturn } from './useAICost';

// Components
export { AIChat, AICostBadge } from './components';
export type { AIChatProps, AICostBadgeProps } from './components';

// Cost utilities (for consumers who need custom cost display)
export { calculateCost, formatCost, mergeCosts, EMPTY_COST } from './cost';
