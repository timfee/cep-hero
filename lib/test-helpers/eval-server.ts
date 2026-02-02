import { expect } from "bun:test";
import { closeSync, existsSync, openSync, unlinkSync, writeFileSync } from "fs";

type EvalServerState = {
  server?: ReturnType<typeof Bun.spawn>;
  startPromise?: Promise<void>;
  ownsServer: boolean;
  ownsLock: boolean;
  refCount: number;
};

type EnsureEvalServerOptions = {
  chatUrl: string;
  manageServer: boolean;
};

const GLOBAL_KEY = "__cepEvalServer";
const LOCK_PATH = `${Bun.env.TMPDIR ?? "/tmp"}/cep-eval-server.lock`;

function getState(): EvalServerState {
  const global = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: EvalServerState;
  };
  if (!global[GLOBAL_KEY]) {
    global[GLOBAL_KEY] = {
      ownsServer: false,
      ownsLock: false,
      refCount: 0,
    } satisfies EvalServerState;
  }
  return global[GLOBAL_KEY] as EvalServerState;
}

/** Ensure a single eval dev server is running. */
export async function ensureEvalServer({
  chatUrl,
  manageServer,
}: EnsureEvalServerOptions): Promise<void> {
  if (process.env.EVAL_TEST_MODE === "1") {
    return;
  }
  if (!manageServer || !chatUrl.includes("localhost")) {
    return;
  }

  const state = getState();
  state.refCount += 1;

  if (!state.ownsLock) {
    state.ownsLock = acquireLock();
  }

  if (await isServerUp(chatUrl)) {
    return;
  }

  if (!state.startPromise) {
    state.startPromise = (async () => {
      if (await isServerUp(chatUrl)) {
        return;
      }
      if (!state.ownsLock) {
        await waitForServer(chatUrl, 60, 500);
        return;
      }
      state.server = Bun.spawn({
        cmd: ["bun", "run", "dev"],
        stdout: "inherit",
        stderr: "inherit",
        env: { ...process.env, PORT: "3100", NODE_ENV: "test" },
      });
      state.ownsServer = true;
      await waitForServer(chatUrl, 60, 500);
    })().finally(() => {
      state.startPromise = undefined;
    });
  }

  await state.startPromise;
}

/** Release the eval dev server when all suites are done. */
export function releaseEvalServer(): void {
  const state = getState();
  state.refCount = Math.max(0, state.refCount - 1);
  if (state.refCount > 0) {
    return;
  }
  if (state.server && state.ownsServer) {
    try {
      state.server.kill();
    } catch {
      // noop
    }
  }
  state.server = undefined;
  state.ownsServer = false;
  if (state.ownsLock && existsSync(LOCK_PATH)) {
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      // noop
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
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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
