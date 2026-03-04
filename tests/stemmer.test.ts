/**
 * Unit tests for the Porter stemmer and normalizeForMatchingStemmed.
 */

import { describe, expect, it } from "bun:test";

import { porterStem, stemText } from "../evals/lib/stemmer";
import {
  normalizeForMatching,
  normalizeForMatchingStemmed,
} from "../evals/lib/utils";

describe("porterStem", () => {
  it("stems plural forms", () => {
    expect(porterStem("increases")).toBe(porterStem("increase"));
    expect(porterStem("policies")).toBe(porterStem("policy"));
    expect(porterStem("extensions")).toBe(porterStem("extension"));
  });

  it("stems -ing forms", () => {
    expect(porterStem("increasing")).toBe(porterStem("increase"));
    expect(porterStem("blocking")).toBe(porterStem("block"));
    expect(porterStem("configuring")).toBe(porterStem("configure"));
  });

  it("stems -ed forms", () => {
    expect(porterStem("corrupted")).toBe(porterStem("corrupt"));
    expect(porterStem("denied")).toBe(porterStem("deny"));
    expect(porterStem("applied")).toBe(porterStem("apply"));
    expect(porterStem("configured")).toBe(porterStem("configure"));
  });

  it("stems -tion/-sion forms", () => {
    expect(porterStem("corruption")).toBe(porterStem("corrupt"));
    expect(porterStem("configuration")).toBe(porterStem("configure"));
  });

  it("returns short words unchanged", () => {
    expect(porterStem("dns")).toBe("dns");
    expect(porterStem("url")).toBe("url");
    expect(porterStem("dlp")).toBe("dlp");
  });

  it("handles already-stemmed words", () => {
    const word = "block";
    expect(porterStem(word)).toBe(porterStem(word));
  });
});

describe("stemText", () => {
  it("stems each word in a string", () => {
    const result = stemText("increasing policies");
    expect(result).toBe(
      `${porterStem("increasing")} ${porterStem("policies")}`
    );
  });

  it("preserves empty strings between words", () => {
    expect(stemText("")).toBe("");
  });
});

describe("normalizeForMatching (no stemming)", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeForMatching("Wi-Fi")).toBe("wifi");
    expect(normalizeForMatching("ERR_NAME")).toBe("errname");
  });

  it("does NOT match morphological variants", () => {
    const needle = normalizeForMatching("increase");
    const haystack = normalizeForMatching("increasing");
    expect(haystack).not.toContain(needle);
  });
});

describe("normalizeForMatchingStemmed", () => {
  it("matches 'increase' against 'increasing'", () => {
    const needle = normalizeForMatchingStemmed("increase");
    const haystack = normalizeForMatchingStemmed(
      "The count is increasing rapidly"
    );
    expect(haystack).toContain(needle);
  });

  it("matches 'corrupt' against 'corruption'", () => {
    const needle = normalizeForMatchingStemmed("corrupt");
    const haystack = normalizeForMatchingStemmed(
      "Data corruption was detected"
    );
    expect(haystack).toContain(needle);
  });

  it("matches 'deny' against 'denied'", () => {
    const needle = normalizeForMatchingStemmed("deny");
    const haystack = normalizeForMatchingStemmed(
      "Access was denied for this user"
    );
    expect(haystack).toContain(needle);
  });

  it("matches 'policy' against 'policies'", () => {
    const needle = normalizeForMatchingStemmed("policy");
    const haystack = normalizeForMatchingStemmed(
      "Multiple policies were applied"
    );
    expect(haystack).toContain(needle);
  });

  it("still handles hyphenated terms like Wi-Fi", () => {
    const needle = normalizeForMatchingStemmed("wifi");
    const haystack = normalizeForMatchingStemmed("Check your Wi-Fi connection");
    expect(haystack).toContain(needle);
  });

  it("still handles exact technical terms", () => {
    const needle = normalizeForMatchingStemmed("ERR_NAME_NOT_RESOLVED");
    const haystack = normalizeForMatchingStemmed(
      "The error ERR_NAME_NOT_RESOLVED appeared in the logs"
    );
    expect(haystack).toContain(needle);
  });
});
