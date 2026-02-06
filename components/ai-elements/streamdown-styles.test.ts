/**
 * CSS regression tests for Streamdown link styling.
 * Parses globals.css to ensure critical styles are never removed.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS_PATH = resolve(import.meta.dir, "../../app/globals.css");
const css = readFileSync(CSS_PATH, "utf-8");

/**
 * Extract the CSS block for a given selector from the raw CSS string.
 */
function extractBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "m");
  const match = css.match(regex);
  return match?.[1] ?? "";
}

describe('Streamdown link styles ([data-streamdown="link"])', () => {
  const block = extractBlock('[data-streamdown="link"]');

  it("sets cursor: pointer so links look clickable", () => {
    expect(block).toContain("cursor: pointer");
  });

  it("sets display: inline so link buttons wrap with text", () => {
    expect(block).toContain("display: inline");
  });

  it("sets overflow-wrap: anywhere to break long URLs", () => {
    expect(block).toContain("overflow-wrap: anywhere");
  });

  it("has underline styling for link affordance", () => {
    expect(block).toContain("text-decoration-line: underline");
  });

  it("lives outside @layer base so it beats Tailwind cascade layers", () => {
    const layerBaseStart = css.indexOf("@layer base {");
    const linkRuleStart = css.indexOf('[data-streamdown="link"]');
    expect(linkRuleStart).toBeGreaterThan(-1);
    expect(linkRuleStart).toBeLessThan(layerBaseStart);
  });
});

describe("Streamdown link hover styles", () => {
  const block = extractBlock('[data-streamdown="link"]:hover');

  it("changes color on hover for interactive feedback", () => {
    expect(block).toContain("color:");
  });
});
