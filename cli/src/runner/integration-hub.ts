/**
 * Integration test helper — starts and stops a hub server for runner integration tests.
 *
 * The hub is spawned as a child process on port 13006 with a hardcoded test token,
 * using /tmp/hapi-integration-test as its data directory.
 *
 * NOTE: vitest runs test workers under Node.js even when invoked via `bun vitest`.
 * This means process.execPath is node, not bun. We resolve the bun binary explicitly
 * and export spawnWithBun() so the test can spawn CLI subprocesses correctly.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export const TEST_HOME = '/tmp/hapi-integration-test';
export const TEST_PORT = 13006;
export const TEST_HOST = '127.0.0.1';
export const TEST_TOKEN = 'hapi-integration-test-token-do-not-use-in-production';

let hubProcess: ChildProcess | null = null;

/** Resolve the bun binary path (process.execPath is node under vitest). */
function bunPath(): string {
    try {
        return execSync('which bun', { encoding: 'utf-8' }).trim();
    } catch {
        // Fallback to common location
        return resolve(process.env.HOME ?? '/home/exedev', '.bun', 'bin', 'bun');
    }
}

const BUN = bunPath();

/** Resolve the CLI entrypoint (cli/src/index.ts). */
function cliEntrypoint(): string {
    return resolve(__dirname, '..', 'index.ts');
}

/**
 * Spawn a HAPI CLI command using bun (not process.execPath which is node under vitest).
 * This is the integration-test equivalent of spawnHappyCLI.
 */
export function spawnCliWithBun(args: string[], options: import('node:child_process').SpawnOptions = {}): ChildProcess {
    return spawn(BUN, [cliEntrypoint(), ...args], {
        cwd: options.cwd ?? process.cwd(),
        ...options,
        env: options.env ?? process.env,
    });
}

export async function startIntegrationHub(): Promise<void> {
    // Kill any stale process on the test port from a previous crashed run
    try {
        execSync(`lsof -ti :${TEST_PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    } catch {
        // No process on port — that's fine
    }

    // Clean slate
    rmSync(TEST_HOME, { recursive: true, force: true });
    mkdirSync(TEST_HOME, { recursive: true });

    // Resolve hub entrypoint relative to this file: cli/src/runner/ → hub/src/index.ts
    const hubEntrypoint = resolve(__dirname, '..', '..', '..', 'hub', 'src', 'index.ts');

    hubProcess = spawn(BUN, ['run', hubEntrypoint], {
        env: {
            ...process.env,
            HAPI_HOME: TEST_HOME,
            CLI_API_TOKEN: TEST_TOKEN,
            HAPI_LISTEN_PORT: String(TEST_PORT),
            HAPI_LISTEN_HOST: TEST_HOST,
            HAPI_PUBLIC_URL: `http://${TEST_HOST}:${TEST_PORT}`,
            DB_PATH: `${TEST_HOME}/test.db`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    hubProcess.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
    });
    hubProcess.on('exit', (code) => {
        if (code && code !== 0) {
            console.error(`[INT-HUB] Hub exited unexpectedly (code ${code}): ${stderr.slice(-500)}`);
        }
    });

    // Poll /health until the hub is ready
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            const r = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`, {
                signal: AbortSignal.timeout(1000),
            });
            if (r.ok) {
                console.log('[INT-HUB] Hub is healthy and ready');
                return;
            }
        } catch {
            // not ready yet
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Integration hub did not become healthy within 15 seconds.\nStderr: ${stderr.slice(-1000)}`);
}

export async function stopIntegrationHub(): Promise<void> {
    if (hubProcess) {
        const proc = hubProcess;
        hubProcess = null;
        proc.kill('SIGTERM');
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                proc.kill('SIGKILL');
                resolve();
            }, 5000);
            proc.on('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    try {
        rmSync(TEST_HOME, { recursive: true, force: true });
    } catch {
        // best effort cleanup
    }
}
