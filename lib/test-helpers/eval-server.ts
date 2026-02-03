/**
 * Manages the eval dev server lifecycle for integration tests.
 */

import {
  closeSync,
  existsSync,
  openSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

interface EvalServerState {
  server?: ReturnType<typeof Bun.spawn>;
  startPromise?: Promise<void>;
  ownsServer: boolean;
  ownsLock: boolean;
  refCount: number;
}

interface EnsureEvalServerOptions {
  chatUrl: string;
  manageServer: boolean;
}

const GLOBAL_KEY = "__cepEvalServer";
const LOCK_PATH = `${Bun.env.TMPDIR ?? "/tmp"}/cep-eval-server.lock`;

/**
 * Get or initialize the global server state.
 */
function getState(): EvalServerState {
  const global = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: EvalServerState;
  };
  global[GLOBAL_KEY] ??= {
    ownsServer: false,
    ownsLock: false,
    refCount: 0,
  } satisfies EvalServerState;
  return global[GLOBAL_KEY];
}

/**
 * Ensure a single eval dev server is running.
 */
export async function ensureEvalServer({
  chatUrl,
  manageServer,
}: EnsureEvalServerOptions) {
  if (shouldSkipServerManagement(chatUrl, manageServer)) {
    return;
  }

  const state = getState();
  incrementRefCount(state);

  if (await isServerUp(chatUrl)) {
    return;
  }

  state.startPromise ??= startServerIfNeeded(state, chatUrl);
  await state.startPromise;
}

/**
 * Check if server management should be skipped.
 */
function shouldSkipServerManagement(chatUrl: string, manageServer: boolean) {
  if (process.env.EVAL_TEST_MODE === "1") {
    return true;
  }
  return !manageServer || !chatUrl.includes("localhost");
}

/**
 * Increment reference count and acquire lock if needed.
 */
function incrementRefCount(state: EvalServerState) {
  state.refCount += 1;
  if (!state.ownsLock) {
    state.ownsLock = acquireLock();
  }
}

/**
 * Start the server if we own the lock, otherwise wait for it.
 */
async function startServerIfNeeded(state: EvalServerState, chatUrl: string) {
  try {
    if (await isServerUp(chatUrl)) {
      return;
    }
    if (!state.ownsLock) {
      await waitForServer(chatUrl, 60, 500);
      return;
    }
    spawnDevServer(state);
    await waitForServer(chatUrl, 60, 500);
  } finally {
    state.startPromise = undefined;
  }
}

/**
 * Spawn the dev server process.
 */
function spawnDevServer(state: EvalServerState) {
  state.server = Bun.spawn({
    cmd: ["bun", "run", "dev"],
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, PORT: "3100", NODE_ENV: "test" },
  });
  state.ownsServer = true;
}

/**
 * Release the eval dev server when all suites are done.
 */
export function releaseEvalServer() {
  const state = getState();
  state.refCount = Math.max(0, state.refCount - 1);
  if (state.refCount > 0) {
    return;
  }
  cleanupServer(state);
  cleanupLock(state);
}

/**
 * Kill the server process if we own it.
 */
function cleanupServer(state: EvalServerState) {
  if (state.server && state.ownsServer) {
    try {
      state.server.kill();
    } catch {
      // Server may already be terminated
    }
  }
  state.server = undefined;
  state.ownsServer = false;
}

/**
 * Remove the lock file if we own it.
 */
function cleanupLock(state: EvalServerState) {
  if (state.ownsLock && existsSync(LOCK_PATH)) {
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      // Lock file may already be removed
    }
  }
  state.ownsLock = false;
}

/**
 * Check if the server is responding to requests.
 */
async function isServerUp(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok || res.status >= 400;
  } catch {
    return false;
  }
}

/**
 * Poll until the server responds or max attempts reached.
 */
async function waitForServer(url: string, attempts: number, delayMs: number) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isServerUp(url)) {
      return;
    }
    await Bun.sleep(delayMs);
  }
}

/**
 * Attempt to acquire an exclusive file lock.
 */
function acquireLock() {
  if (existsSync(LOCK_PATH)) {
    return false;
  }
  try {
    const fd = openSync(LOCK_PATH, "wx");
    writeFileSync(fd, String(process.pid));
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}
