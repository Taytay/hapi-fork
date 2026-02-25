/**
 * Runner-specific types (not related to API/server communication)
 */

import type { ChildProcess } from 'node:child_process';
import type { Metadata } from '@/api/types';

/**
 * Session tracking for runner
 */
export interface TrackedSession {
    startedBy: 'runner' | string;
    happySessionId?: string;
    happySessionMetadataFromLocalWebhook?: Metadata;
    pid: number;
    childProcess?: ChildProcess;
    error?: string;
    directoryCreated?: boolean;
    message?: string;
}
