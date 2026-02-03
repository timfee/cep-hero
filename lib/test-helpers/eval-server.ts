/* eslint-disable import/no-nodejs-modules */
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

/** Ensure a single eval dev server is running. */
export async function ensureEvalServer({
  chatUrl,
  manageServer,
}: EnsureEvalServerOptions): Promise<void> {
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

function shouldSkipServerManagement(
  chatUrl: string,
  manageServer: boolean
): boolean {
  if (process.env.EVAL_TEST_MODE === "1") {
    return true;
  }
  return !manageServer || !chatUrl.includes("localhost");
}

function incrementRefCount(state: EvalServerState): void {
  state.refCount += 1;
  if (!state.ownsLock) {
    state.ownsLock = acquireLock();
  }
}

async function startServerIfNeeded(
  state: EvalServerState,
  chatUrl: string
): Promise<void> {
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

function spawnDevServer(state: EvalServerState): void {
  state.server = Bun.spawn({
    cmd: ["bun", "run", "dev"],
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, PORT: "3100", NODE_ENV: "test" },
  });
  state.ownsServer = true;
}

/** Release the eval dev server when all suites are done. */
export function releaseEvalServer(): void {
  const state = getState();
  state.refCount = Math.max(0, state.refCount - 1);
  if (state.refCount > 0) {
    return;
  }
  cleanupServer(state);
  cleanupLock(state);
}

function cleanupServer(state: EvalServerState): void {
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

function cleanupLock(state: EvalServerState): void {
  if (state.ownsLock && existsSync(LOCK_PATH)) {
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      // Lock file may already be removed
    }
  }
  state.ownsLock = false;
}

async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok || res.status >= 400;
  } catch {
    return false;
  }
}

async function waitForServer(
  url: string,
  attempts: number,
  delayMs: number
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (await isServerUp(url)) {
      return;
    }
    await Bun.sleep(delayMs);
  }
}

function acquireLock(): boolean {
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
