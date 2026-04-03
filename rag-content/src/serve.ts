/**
 * Standalone MCP server that exposes the RAG content SQLite database as a query tool.
 * Runs over stdio — connect it to any MCP-compatible agent or IDE.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "rag-content.db");

/**
 * Open the SQLite database in read-only mode.
 */
function openDatabase(): InstanceType<typeof Database> {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}. Run "npm run build:db" first.`);
  }
  return new Database(DB_PATH, { readonly: true });
}

/**
 * Start the MCP server with the searchContent tool registered.
 */
async function main(): Promise<void> {
  const db = openDatabase();

  const server = new McpServer({
    name: "rag-content",
    version: "1.0.0",
  });

  server.registerTool(
    "searchContent",
    {
      description:
        "Full-text search across Chrome Enterprise policies, help center articles, " +
        "cloud docs, and curated content. Uses SQLite FTS5 with Porter stemming. " +
        "Returns matching documents with title, URL, kind, and a content snippet.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            "Search query. Supports FTS5 syntax: plain words, quoted phrases, " +
              'AND/OR/NOT operators, column filters (e.g. "kind:policies password").',
          ),
        kind: z
          .enum(["policies", "helpcenter", "cloud-docs", "curated"])
          .optional()
          .describe("Filter results to a specific content type."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum number of results to return (default 10)."),
      }),
    },
    (args) => {
      const limit = args.limit ?? 10;
      let ftsQuery = args.query;

      // If filtering by kind, add it as an FTS5 column filter
      if (args.kind) {
        ftsQuery = `kind:${args.kind} ${ftsQuery}`;
      }

      const rows = db
        .prepare(
          `
          SELECT
            d.id,
            d.filename,
            d.kind,
            d.title,
            d.url,
            d.policy_name,
            d.article_type,
            d.article_id,
            d.deprecated,
            d.tags,
            snippet(documents_fts, 1, '>>>', '<<<', '...', 64) AS snippet,
            rank
          FROM documents_fts f
          JOIN documents d ON d.id = f.rowid
          WHERE documents_fts MATCH @query
          ORDER BY rank
          LIMIT @limit
        `,
        )
        .all({ query: ftsQuery, limit });

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No results found for: ${args.query}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "getDocument",
    {
      description:
        "Retrieve the full content of a specific document by its kind and filename. " +
        "Use this after searchContent to read the complete text of a result.",
      inputSchema: z.object({
        kind: z
          .enum(["policies", "helpcenter", "cloud-docs", "curated"])
          .describe("The content type / directory."),
        filename: z
          .string()
          .min(1)
          .describe("The filename (without .md extension) as returned by searchContent."),
      }),
    },
    (args) => {
      const row = db
        .prepare(
          `SELECT title, url, kind, content, tags, features,
                  policy_name, deprecated, device_only,
                  supported_platforms_text, article_type, article_id
           FROM documents
           WHERE kind = @kind AND filename = @filename`,
        )
        .get({ kind: args.kind, filename: args.filename }) as Record<string, unknown> | undefined;

      if (!row) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Document not found: ${args.kind}/${args.filename}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(row, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "listDocuments",
    {
      description:
        "List all documents in a content directory, or get a count per kind. " +
        "Useful for browsing available content without searching.",
      inputSchema: z.object({
        kind: z
          .enum(["policies", "helpcenter", "cloud-docs", "curated"])
          .optional()
          .describe("Filter to a specific content type. Omit for counts across all kinds."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "Maximum number of documents to list (default 50). Ignored when kind is omitted.",
          ),
      }),
    },
    (args) => {
      if (!args.kind) {
        const counts = db
          .prepare("SELECT kind, COUNT(*) as count FROM documents GROUP BY kind ORDER BY kind")
          .all();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(counts, null, 2) }],
        };
      }

      const limit = args.limit ?? 50;
      const rows = db
        .prepare(
          `SELECT filename, title, url FROM documents
           WHERE kind = @kind
           ORDER BY title
           LIMIT @limit`,
        )
        .all({ kind: args.kind, limit });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
