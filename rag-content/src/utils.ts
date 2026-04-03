/**
 * Shared utilities for RAG content generation: file writing, slugification, and HTML conversion.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import TurndownService from "turndown";

import type { RagDocument } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

/**
 * Convert a string to a safe filesystem slug.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/**
 * Remove "Was this helpful?" trailing section from HTML.
 */
export function cleanHtml(html: string): string {
  return html.split(/Was this helpful\?/i)[0] || html;
}

/**
 * Normalize a URL to a standard ID format without query parameters or hash.
 */
export function getStandardId(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Escape a YAML string value, wrapping in quotes if it contains special characters.
 */
function yamlValue(value: unknown): string {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  const str = String(value);
  if (
    str.includes(":") ||
    str.includes("#") ||
    str.includes('"') ||
    str.includes("'") ||
    str.includes("\n") ||
    str.startsWith("[") ||
    str.startsWith("{") ||
    str === ""
  ) {
    return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * Serialize a flat metadata object to YAML front matter lines.
 */
function toFrontMatter(fields: Record<string, unknown>): string {
  const lines: string[] = ["---"];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${yamlValue(item)}`);
        }
      }
    } else if (typeof value === "object") {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (subValue !== undefined && subValue !== null) {
          lines.push(`  ${subKey}: ${yamlValue(subValue)}`);
        }
      }
    } else {
      lines.push(`${key}: ${yamlValue(value)}`);
    }
  }

  lines.push("---");
  return lines.join("\n");
}

/**
 * Remove all files in an output subdirectory and recreate it.
 */
export function clearOutputDir(subdir: string): void {
  const dir = path.join(ROOT, subdir);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write a single RagDocument as a markdown file with YAML front matter.
 */
export function writeDocument(subdir: string, doc: RagDocument): void {
  const dir = path.join(ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });

  const frontMatter = toFrontMatter({
    title: doc.title,
    url: doc.url,
    kind: doc.kind,
    fetchedAt: new Date().toISOString(),
    ...doc.metadata,
  });

  const fileContent = `${frontMatter}\n\n${doc.content}\n`;
  const filePath = path.join(dir, `${doc.filename}.md`);
  fs.writeFileSync(filePath, fileContent, "utf-8");
}

/**
 * Run prettier against all markdown files in an output subdirectory.
 */
function formatMarkdown(subdir: string): void {
  const dir = path.join(ROOT, subdir);
  try {
    execSync(`npx prettier --write "${dir}/**/*.md"`, {
      cwd: ROOT,
      stdio: "pipe",
    });
    console.log(`Formatted ${subdir}/ with prettier`);
  } catch {
    console.warn(`Warning: prettier formatting failed for ${subdir}/, skipping`);
  }
}

/**
 * Clear the output directory, write all documents as markdown files, then format them.
 */
export function writeDocuments(subdir: string, docs: RagDocument[]): void {
  clearOutputDir(subdir);
  for (const doc of docs) {
    writeDocument(subdir, doc);
  }
  console.log(`Wrote ${docs.length} files to ${subdir}/`);
  formatMarkdown(subdir);
}
