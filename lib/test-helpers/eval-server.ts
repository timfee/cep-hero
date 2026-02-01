type EvalServerState = {
  server?: ReturnType<typeof Bun.spawn>;
  startPromise?: Promise<void>;
  ownsServer: boolean;
  refCount: number;
};

type EnsureEvalServerOptions = {
  chatUrl: string;
  manageServer: boolean;
};

const GLOBAL_KEY = "__cepEvalServer";

function getState(): EvalServerState {
  const global = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: EvalServerState;
  };
  if (!global[GLOBAL_KEY]) {
    global[GLOBAL_KEY] = {
      ownsServer: false,
      refCount: 0,
    };
  }
  return global[GLOBAL_KEY];
}

/** Ensure a single eval dev server is running. */
export async function ensureEvalServer({
  chatUrl,
  manageServer,
}: EnsureEvalServerOptions): Promise<void> {
  if (!manageServer || !chatUrl.includes("localhost")) {
    return;
  }

  const state = getState();
  state.refCount += 1;

  if (await isServerUp(chatUrl)) {
    return;
  }

  if (!state.startPromise) {
    state.startPromise = (async () => {
      if (await isServerUp(chatUrl)) {
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
