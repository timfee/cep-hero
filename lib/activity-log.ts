export type ActivityKind = "mcp" | "workspace";

export type ActivityEntry = {
  id: string;
  url: string;
  method: string;
  status: number | "error";
  durationMs: number;
  responsePreview?: string;
  timestamp: number;
  kind: ActivityKind;
};

const activityLog: ActivityEntry[] = [];

export function recordActivity(entry: ActivityEntry) {
  activityLog.unshift(entry);
  if (activityLog.length > 200) {
    activityLog.length = 200;
  }
}

export function getActivityEntries() {
  return activityLog;
}
