import { appendFile } from "node:fs/promises";

type DebugEntry = {
  ts: string;
  event: string;
  data?: Record<string, unknown>;
};

const LOG_PATH = `${process.cwd()}/debug.log`;

export async function writeDebugLog(
  event: string,
  data?: Record<string, unknown>
) {
  const entry: DebugEntry = {
    ts: new Date().toISOString(),
    event,
    data,
  };

  try {
    await appendFile(LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    // Swallow logging errors to avoid breaking the request path.
    console.error("[debug.log] append failed", error);
  }
}
