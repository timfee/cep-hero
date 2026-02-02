export type ActivityEntry = {
  id: string;
  url: string;
  method: string;
  status: number | "error";
  durationMs: number;
  responsePreview?: string;
  timestamp: number;
  kind: "mcp" | "workspace";
};

export type ActivityFilter = "all" | "mcp" | "workspace";
