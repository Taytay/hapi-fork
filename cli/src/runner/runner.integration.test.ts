/**
 * Integration tests for runner HTTP control system
 *
 * Tests the full flow of runner startup, session tracking, and shutdown.
 *
 * The test suite automatically starts a hub server (on port 13006) with a
 * hardcoded test token before running. Environment variables are loaded from
 * cli/.env.integration-test by vitest.config.ts.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Metadata } from '@/api/types';
import { configuration } from '@/configuration';
import { clearRunnerState, readRunnerState } from '@/persistence';
import {
    listRunnerSessions,
    notifyRunnerSessionStarted,
    spawnRunnerSession,
    stopRunner,
    stopRunnerHttp,
    stopRunnerSession,
} from '@/runner/controlClient';
import { spawnCliWithBun, startIntegrationHub, stopIntegrationHub } from '@/runner/integration-hub';
import { getLatestRunnerLog } from '@/ui/logger';
import { isProcessAlive, isWindows, killProcess, killProcessByChildProcess } from '@/utils/process';

// Utility to wait for condition
async function waitFor(condition: () => Promise<boolean>, timeout = 5000, interval = 100): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await condition()) return;
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
}

describe('Runner Integration Tests', { timeout: 30_000 }, () => {
    beforeAll(async () => {
        await startIntegrationHub();
    }, 20_000);

    afterAll(async () => {
        await stopRunner();
        await stopIntegrationHub();
    }, 15_000);
    let runnerPid: number;

    beforeEach(async () => {
        // First ensure no runner is running by checking PID in metadata file
        await stopRunner();

        // Start fresh runner for this test (use spawnCliWithBun since vitest runs under node)
        void spawnCliWithBun(['runner', 'start'], {
            stdio: 'ignore',
        });

        // Wait for runner to write its state file (it needs to auth, setup, and start server)
        await waitFor(
            async () => {
                const state = await readRunnerState();
                return state !== null;
            },
            15_000,
            250,
        ); // Wait up to 15 seconds, checking every 250ms

        const runnerState = await readRunnerState();
        if (!runnerState) {
            throw new Error('Runner failed to start within timeout');
        }
        runnerPid = runnerState.pid;

        console.log(`[TEST] Runner started for test: PID=${runnerPid}`);
        console.log(`[TEST] Runner log file: ${runnerState?.runnerLogPath}`);
    }, 20_000);

    afterEach(async () => {
        await stopRunner();
    });

    it('should list sessions (initially empty)', async () => {
        const sessions = await listRunnerSessions();
        expect(sessions).toEqual([]);
    });

    it('should track session-started webhook from terminal session', async () => {
        // Simulate a terminal-started session reporting to runner
        const mockMetadata: Metadata = {
            path: '/test/path',
            host: 'test-host',
            homeDir: '/test/home',
            happyHomeDir: '/test/happy-home',
            happyLibDir: '/test/happy-lib',
            happyToolsDir: '/test/happy-tools',
            hostPid: 99999,
            startedBy: 'terminal',
            machineId: 'test-machine-123',
        };

        await notifyRunnerSessionStarted('test-session-123', mockMetadata);

        // Verify session is tracked
        const sessions = await listRunnerSessions();
        expect(sessions).toHaveLength(1);

        const tracked = sessions[0];
        expect(tracked.startedBy).toBe('hapi directly - likely by user from terminal');
        expect(tracked.happySessionId).toBe('test-session-123');
        expect(tracked.pid).toBe(99999);
    });

    // Requires built CLI — spawnHappyCLI inside the runner can't resolve @/ path aliases from source
    it.skip('should spawn & stop a session via HTTP (not testing RPC route, but similar enough)', async () => {
        const response = await spawnRunnerSession('/tmp', 'spawned-test-456');

        expect(response).toHaveProperty('success', true);
        expect(response).toHaveProperty('sessionId');

        // Verify session is tracked
        const sessions = await listRunnerSessions();
        const spawnedSession = sessions.find((s: any) => s.happySessionId === response.sessionId);

        expect(spawnedSession).toBeDefined();
        expect(spawnedSession.startedBy).toBe('runner');

        // Clean up - stop the spawned session
        expect(spawnedSession.happySessionId).toBeDefined();
        await stopRunnerSession(spawnedSession.happySessionId);
    });

    // Requires built CLI
    it.skip('stress test: spawn / stop', { timeout: 60_000 }, async () => {
        const promises = [];
        const sessionCount = 20;
        for (let i = 0; i < sessionCount; i++) {
            promises.push(spawnRunnerSession('/tmp'));
        }

        // Wait for all sessions to be spawned
        const results = await Promise.all(promises);
        const sessionIds = results.map((r) => r.sessionId);

        const sessions = await listRunnerSessions();
        expect(sessions).toHaveLength(sessionCount);

        // Stop all sessions
        const stopResults = await Promise.all(sessionIds.map((sessionId) => stopRunnerSession(sessionId)));
        expect(
            stopResults.every((r) => r),
            'Not all sessions reported stopped',
        ).toBe(true);

        // Verify all sessions are stopped
        const emptySessions = await listRunnerSessions();
        expect(emptySessions).toHaveLength(0);
    });

    it('should handle runner stop request gracefully', async () => {
        await stopRunnerHttp();

        // Verify metadata file is cleaned up
        await waitFor(async () => !existsSync(configuration.runnerStateFile), 1000);
    });

    // Requires built CLI
    it.skip('should track both runner-spawned and terminal sessions', async () => {
        // Spawn a real hapi process that looks like it was started from terminal
        const terminalHappyProcess = spawnCliWithBun(['--hapi-starting-mode', 'remote', '--started-by', 'terminal'], {
            cwd: '/tmp',
            detached: true,
            stdio: 'ignore',
        });
        if (!terminalHappyProcess || !terminalHappyProcess.pid) {
            throw new Error('Failed to spawn terminal hapi process');
        }
        // Give time to start & report itself
        await new Promise((resolve) => setTimeout(resolve, 5_000));

        // Spawn a runner session
        const spawnResponse = await spawnRunnerSession('/tmp', 'runner-session-bbb');

        // List all sessions
        const sessions = await listRunnerSessions();
        expect(sessions).toHaveLength(2);

        // Verify we have one of each type
        const terminalSession = sessions.find((s: any) => s.pid === terminalHappyProcess.pid);
        const runnerSession = sessions.find((s: any) => s.happySessionId === spawnResponse.sessionId);

        expect(terminalSession).toBeDefined();
        expect(terminalSession.startedBy).toBe('hapi directly - likely by user from terminal');

        expect(runnerSession).toBeDefined();
        expect(runnerSession.startedBy).toBe('runner');

        // Clean up both sessions
        await stopRunnerSession('terminal-session-aaa');
        await stopRunnerSession(runnerSession.happySessionId);

        // Also kill the terminal process directly to be sure
        try {
            await killProcessByChildProcess(terminalHappyProcess);
        } catch (_e) {
            // Process might already be dead
        }
    });

    // Requires built CLI
    it.skip('should update session metadata when webhook is called', async () => {
        // Spawn a session
        const spawnResponse = await spawnRunnerSession('/tmp');

        // Verify webhook was processed (session ID updated)
        const sessions = await listRunnerSessions();
        const session = sessions.find((s: any) => s.happySessionId === spawnResponse.sessionId);
        expect(session).toBeDefined();

        // Clean up
        await stopRunnerSession(spawnResponse.sessionId);
    });

    it('should not allow starting a second runner', async () => {
        // Runner is already running from beforeEach
        // Try to start another runner (use spawnCliWithBun since vitest runs under node)
        const secondChild = spawnCliWithBun(['runner', 'start-sync'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        secondChild.stdout?.on('data', (data) => {
            output += data.toString();
        });
        secondChild.stderr?.on('data', (data) => {
            output += data.toString();
        });

        // Wait for the second runner to exit
        await new Promise<void>((resolve) => {
            secondChild.on('exit', () => resolve());
        });

        // Should report that runner is already running
        expect(output).toContain('already running');
    });

    // Requires built CLI
    it.skip('should handle concurrent session operations', async () => {
        // Spawn multiple sessions concurrently
        const promises = [];
        for (let i = 0; i < 3; i++) {
            promises.push(spawnRunnerSession('/tmp'));
        }

        const results = await Promise.all(promises);

        // All should succeed
        results.forEach((res) => {
            expect(res.success).toBe(true);
            expect(res.sessionId).toBeDefined();
        });

        // Collect session IDs for tracking
        const spawnedSessionIds = results.map((r) => r.sessionId);

        // Give sessions time to report via webhook
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // List should show all sessions
        const sessions = await listRunnerSessions();
        const runnerSessions = sessions.filter(
            (s: any) => s.startedBy === 'runner' && spawnedSessionIds.includes(s.happySessionId),
        );
        expect(runnerSessions.length).toBeGreaterThanOrEqual(3);

        // Stop all spawned sessions
        for (const session of runnerSessions) {
            expect(session.happySessionId).toBeDefined();
            await stopRunnerSession(session.happySessionId);
        }
    });

    it('should die with logs when SIGKILL is sent', async () => {
        // SIGKILL test - runner should die immediately
        const logsDir = configuration.logsDir;
        const { readdirSync } = await import('node:fs');

        // Get initial log files
        const initialLogs = readdirSync(logsDir).filter((f) => f.endsWith('-runner.log'));

        // Send SIGKILL to runner (force kill)
        await killProcess(runnerPid, true);

        // Wait for process to die
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if process is dead
        const isDead = !isProcessAlive(runnerPid);
        expect(isDead).toBe(true);

        // Check that log file exists (it was created when runner started)
        const finalLogs = readdirSync(logsDir).filter((f) => f.endsWith('-runner.log'));
        expect(finalLogs.length).toBeGreaterThanOrEqual(initialLogs.length);

        // The runner won't have time to write cleanup logs with SIGKILL
        console.log('[TEST] Runner killed with SIGKILL - no cleanup logs expected');

        // Clean up state file manually since runner couldn't do it
        await clearRunnerState();
    });

    it('should die with cleanup logs when a graceful shutdown is requested', async () => {
        // Graceful shutdown test - runner should cleanup gracefully
        const logFile = await getLatestRunnerLog();
        if (!logFile) {
            throw new Error('No log file found');
        }

        if (isWindows()) {
            // Windows taskkill does not deliver SIGTERM/SIGBREAK to Node handlers.
            await stopRunnerHttp();
        } else {
            // Send SIGTERM to runner (graceful shutdown)
            await killProcess(runnerPid);
        }

        // Wait for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 4_000));

        // Check if process is dead
        const isDead = !isProcessAlive(runnerPid);
        expect(isDead).toBe(true);

        // Read the log file to check for cleanup messages
        const logContent = readFileSync(logFile.path, 'utf8');

        // Should contain cleanup messages
        if (!isWindows()) {
            expect(logContent).toContain('SIGTERM');
        }
        expect(logContent).toContain('cleanup');

        console.log('[TEST] Runner terminated gracefully - cleanup logs written');

        // Clean up state file if it still exists (should have been cleaned by SIGTERM handler)
        await clearRunnerState();
    });

    /**
     * Version mismatch detection test - control flow:
     *
     * 1. Test starts runner with original version (e.g., 0.9.0-6) compiled into dist/
     * 2. Test modifies package.json to new version (e.g., 0.0.0-integration-test-*)
     * 3. Test runs `yarn build` to recompile with new version
     * 4. Runner's heartbeat (every 30s) reads package.json and compares to its compiled version
     * 5. Runner detects mismatch: package.json != configuration.currentCliVersion
     * 6. Runner spawns new runner via spawnHappyCLI(['runner', 'start'])
     * 7. New runner starts, reads runner.state.json, sees old version != its compiled version
     * 8. New runner calls stopRunner() to kill old runner, then takes over
     *
     * This simulates what happens during `npm upgrade hapi`:
     * - Running runner has OLD version loaded in memory (configuration.currentCliVersion)
     * - npm replaces node_modules/hapi/ with NEW version files
     * - package.json on disk now has NEW version
     * - Runner reads package.json, detects mismatch, triggers self-update
     * - Key difference: npm atomically replaces the entire module directory, while
     *   our test must carefully rebuild to avoid missing entrypoint errors
     *
     * Critical timing constraints:
     * - Heartbeat must be long enough (30s) for yarn build to complete before runner tries to spawn
     * - If heartbeat fires during rebuild, spawn fails (entrypoint missing) and test fails
     * - pkgroll doesn't reliably update compiled version, must use full yarn build
     * - Test modifies package.json BEFORE rebuild to ensure new version is compiled in
     *
     * Common failure modes:
     * - Heartbeat too short: runner tries to spawn while dist/ is being rebuilt
     * - Using pkgroll alone: doesn't update compiled configuration.currentCliVersion
     * - Modifying package.json after runner starts: triggers immediate version check on startup
     */
    // Requires built CLI (uses bun run build:cli)
    it.skip('[takes 1 minute to run] should detect version mismatch and kill old runner', { timeout: 100_000 }, async () => {
        // Read current package.json to get version
        const packagePath = path.join(process.cwd(), 'package.json');
        const packageJsonOriginalRawText = readFileSync(packagePath, 'utf8');
        const originalPackage = JSON.parse(packageJsonOriginalRawText);
        const originalVersion = originalPackage.version;
        const testVersion = `0.0.0-integration-test-should-be-auto-cleaned-up-${Math.floor(Math.random() * 100000)
            .toString()
            .padStart(5, '0')}`;

        expect(originalVersion, 'Your current cli version was not cleaned up from previous test it seems').not.toBe(
            testVersion,
        );

        // Modify package.json version
        const modifiedPackage = { ...originalPackage, version: testVersion };
        writeFileSync(packagePath, JSON.stringify(modifiedPackage, null, 2));

        try {
            // Get initial runner state
            const initialState = await readRunnerState();
            expect(initialState).toBeDefined();
            expect(initialState?.startedWithCliVersion).toBe(originalVersion);
            const initialPid = initialState?.pid;

            // Re-build the CLI - so it will import the new package.json in its configuartion.ts
            // and think it is a new version
            // We are not using yarn build here because it cleans out dist/
            // and we want to avoid that,
            // otherwise runner will spawn a non existing happy js script.
            // We need to remove index, but not the other files, otherwise some of our code might fail when called from within the runner.
            execSync('bun run build:cli', { stdio: 'ignore' });

            console.log(`[TEST] Current runner running with version ${originalVersion}, PID: ${initialPid}`);

            console.log(`[TEST] Changed package.json version to ${testVersion}`);

            // The runner should automatically detect the version mismatch and restart itself
            // We check once per minute, wait for a little longer than that
            await new Promise((resolve) =>
                setTimeout(resolve, parseInt(process.env.HAPI_RUNNER_HEARTBEAT_INTERVAL || '30000', 10) + 10_000),
            );

            // Check that the runner is running with the new version
            const finalState = await readRunnerState();
            expect(finalState).toBeDefined();
            expect(finalState?.startedWithCliVersion).toBe(testVersion);
            expect(finalState?.pid).not.toBe(initialPid);
            console.log('[TEST] Runner version mismatch detection successful');
        } finally {
            // CRITICAL: Restore original package.json version
            writeFileSync(packagePath, packageJsonOriginalRawText);
            console.log(`[TEST] Restored package.json version to ${originalVersion}`);

            // Lets rebuild it so we keep it as we found it
            execSync('bun run build:cli', { stdio: 'ignore' });
        }
    });

    // TODO: Add a test to see if a corrupted file will work

    // TODO: Test npm uninstall scenario - runner should gracefully handle when hapi is uninstalled
    // Current behavior: runner tries to spawn new runner on version mismatch but entrypoint is gone
    // Expected: runner should detect missing entrypoint and either exit cleanly or at minimum not respawn infinitely
});
