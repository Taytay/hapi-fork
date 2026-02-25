/**
 * Claude Code SDK integration for HAPI CLI
 * Provides clean TypeScript implementation without Bun support
 */

export { query } from './query';
export type {
    CanCallToolCallback,
    ControlRequest,
    InterruptRequest,
    PermissionResult,
    QueryOptions,
    QueryPrompt,
    SDKAssistantMessage,
    SDKControlRequest,
    SDKControlResponse,
    SDKMessage,
    SDKResultMessage,
    SDKSystemMessage,
    SDKUserMessage,
} from './types';
export { AbortError } from './types';
