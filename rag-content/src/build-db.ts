/**
 * Reads all markdown files from content directories, parses front matter and body,
 * and builds a SQLite database with FTS5 full-text search.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "rag-content.db");

const CONTENT_DIRS = ["policies", "helpcenter", "cloud-docs", "curated"];

/**
 * Parse YAML front matter and body from a markdown file's contents.
 */
function parseFrontMatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw };
  }

  const meta: Record<string, unknown> = {};
  const yamlBlock = match[1];
  const body = match[2];

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;
  let currentObject: Record<string, unknown> | null = null;

  for (const line of yamlBlock.split("\n")) {
    // Array item
    if (/^ {2}- /.test(line) && currentKey && currentArray) {
      currentArray.push(line.replace(/^ {2}- /, "").replace(/^"|"$/g, ""));
      continue;
    }

    // Nested object field
    if (/^ {2}\w/.test(line) && currentKey && currentObject) {
      const nestedMatch = line.match(/^\s+(\w+):\s*(.+)$/);
      if (nestedMatch) {
        currentObject[nestedMatch[1]] = parseYamlValue(nestedMatch[2]);
      }
      continue;
    }

    // Flush previous collection
    if (currentKey && currentArray) {
      meta[currentKey] = currentArray;
      currentArray = null;
    }
    if (currentKey && currentObject) {
      meta[currentKey] = currentObject;
      currentObject = null;
    }

    // Top-level key: value
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!kvMatch) {
      continue;
    }

    const key = kvMatch[1];
    const value = kvMatch[2];
    currentKey = key;

    if (value === "" || value === undefined) {
      // Could be array or object — peek detection handled by next iteration
      currentArray = [];
      currentObject = {};
    } else if (value === "[]") {
      meta[key] = [];
      currentKey = null;
    } else {
      meta[key] = parseYamlValue(value);
      currentKey = null;
      currentArray = null;
      currentObject = null;
    }
  }

  // Flush trailing collection
  if (currentKey && currentArray && currentArray.length > 0) {
    meta[currentKey] = currentArray;
  } else if (currentKey && currentObject && Object.keys(currentObject).length > 0) {
    meta[currentKey] = currentObject;
  }

  return { meta, body };
}

/**
 * Parse a single YAML scalar value into a JS type.
 */
function parseYamlValue(raw: string): string | number | boolean {
  const trimmed = raw.replace(/^"|"$/g, "");
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

/**
 * Collect all .md files from a content directory.
 */
function collectFiles(dir: string): { filepath: string; kind: string }[] {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) {
    return [];
  }

  return fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ filepath: path.join(fullDir, f), kind: dir }));
}

/**
 * Build the SQLite database from all content directories.
 */
function buildDatabase(): void {
  // Remove existing DB for a clean rebuild
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Main documents table with all front matter columns
  db.exec(`
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT,
      url TEXT,
      fetched_at TEXT,
      content TEXT NOT NULL,

      -- Policy-specific
      policy_id INTEGER,
      policy_name TEXT,
      deprecated INTEGER,
      device_only INTEGER,
      supported_platforms_text TEXT,
      tags TEXT,
      features TEXT,

      -- Help center-specific
      article_type TEXT,
      article_id TEXT,

      UNIQUE(kind, filename)
    );
  `);

  // FTS5 virtual table for full-text search over title + content
  db.exec(`
    CREATE VIRTUAL TABLE documents_fts USING fts5(
      title,
      content,
      kind,
      content=documents,
      content_rowid=id,
      tokenize='porter unicode61'
    );
  `);

  // Triggers to keep FTS index in sync
  db.exec(`
    CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, content, kind)
      VALUES (new.id, new.title, new.content, new.kind);
    END;
  `);

  db.exec(`
    CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, content, kind)
      VALUES ('delete', old.id, old.title, old.content, old.kind);
    END;
  `);

  db.exec(`
    CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, content, kind)
      VALUES ('delete', old.id, old.title, old.content, old.kind);
      INSERT INTO documents_fts(rowid, title, content, kind)
      VALUES (new.id, new.title, new.content, new.kind);
    END;
  `);

  const insert = db.prepare(`
    INSERT INTO documents (
      filename, kind, title, url, fetched_at, content,
      policy_id, policy_name, deprecated, device_only,
      supported_platforms_text, tags, features,
      article_type, article_id
    ) VALUES (
      @filename, @kind, @title, @url, @fetchedAt, @content,
      @policyId, @policyName, @deprecated, @deviceOnly,
      @supportedPlatformsText, @tags, @features,
      @articleType, @articleId
    )
  `);

  const insertMany = db.transaction((rows: ReturnType<typeof buildRow>[]) => {
    for (const row of rows) {
      insert.run(row);
    }
  });

  let totalFiles = 0;

  for (const dir of CONTENT_DIRS) {
    const files = collectFiles(dir);
    if (files.length === 0) {
      console.log(`${dir}/: no files found, skipping`);
      continue;
    }

    const rows = files.map(({ filepath, kind }) => {
      const raw = fs.readFileSync(filepath, "utf-8");
      const { meta, body } = parseFrontMatter(raw);
      const filename = path.basename(filepath, ".md");
      return buildRow(filename, kind, meta, body);
    });

    insertMany(rows);
    totalFiles += rows.length;
    console.log(`${dir}/: indexed ${rows.length} files`);
  }

  db.close();
  console.log(`\nDatabase built: ${DB_PATH} (${totalFiles} documents)`);
}

/**
 * Map parsed front matter + body into a row for the documents table.
 */
function buildRow(filename: string, kind: string, meta: Record<string, unknown>, body: string) {
  return {
    filename,
    kind,
    title: asStringOrNull(meta.title),
    url: asStringOrNull(meta.url),
    fetchedAt: asStringOrNull(meta.fetchedAt),
    content: body,
    policyId: asNumberOrNull(meta.policyId),
    policyName: asStringOrNull(meta.policyName),
    deprecated: asBoolIntOrNull(meta.deprecated),
    deviceOnly: asBoolIntOrNull(meta.deviceOnly),
    supportedPlatformsText: asStringOrNull(meta.supportedPlatformsText),
    tags: meta.tags ? JSON.stringify(meta.tags) : null,
    features: meta.features ? JSON.stringify(meta.features) : null,
    articleType: asStringOrNull(meta.articleType),
    articleId: asStringOrNull(meta.articleId),
  };
}

/**
 * Coerce a value to string or null.
 */
function asStringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value !== null && value !== undefined) return String(value);
  return null;
}

/**
 * Coerce a value to number or null.
 */
function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Coerce a boolean to 0/1 for SQLite, or null.
 */
function asBoolIntOrNull(value: unknown): number | null {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === "true") return 1;
  if (value === "false") return 0;
  return null;
}

buildDatabase();
