/**
 * Tests for the shared authentication status utilities.
 *
 * Covers the formatTimeRemaining pure function which converts
 * seconds into human-readable time strings for the UI.
 */

import { describe, expect, it } from "bun:test";

import { formatTimeRemaining } from "./status";

describe("formatTimeRemaining", () => {
  it("returns 'Expired' for zero seconds", () => {
    expect(formatTimeRemaining(0)).toBe("Expired");
  });

  it("returns 'Expired' for negative seconds", () => {
    expect(formatTimeRemaining(-100)).toBe("Expired");
  });

  it("shows '<1m' when under a minute", () => {
    expect(formatTimeRemaining(45)).toBe("<1m");
  });

  it("shows '<1m' for a single second", () => {
    expect(formatTimeRemaining(1)).toBe("<1m");
  });

  it("formats minutes without seconds", () => {
    expect(formatTimeRemaining(125)).toBe("2m");
  });

  it("formats exact minutes", () => {
    expect(formatTimeRemaining(300)).toBe("5m");
  });

  it("formats hours and minutes without seconds", () => {
    expect(formatTimeRemaining(3661)).toBe("1h 1m");
  });

  it("formats exact hours with zero minutes", () => {
    expect(formatTimeRemaining(7200)).toBe("2h 0m");
  });

  it("floors fractional seconds into minutes", () => {
    expect(formatTimeRemaining(59.9)).toBe("<1m");
  });

  it("handles large values (24+ hours)", () => {
    const result = formatTimeRemaining(90061);
    expect(result).toBe("25h 1m");
  });
});
