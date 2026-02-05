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

  it("formats seconds only when under a minute", () => {
    expect(formatTimeRemaining(45)).toBe("45s");
  });

  it("formats single second", () => {
    expect(formatTimeRemaining(1)).toBe("1s");
  });

  it("formats minutes and seconds", () => {
    expect(formatTimeRemaining(125)).toBe("2m 5s");
  });

  it("formats exact minutes with zero seconds", () => {
    expect(formatTimeRemaining(300)).toBe("5m 0s");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatTimeRemaining(3661)).toBe("1h 1m 1s");
  });

  it("formats exact hours with zero minutes", () => {
    expect(formatTimeRemaining(7200)).toBe("2h 0m 0s");
  });

  it("formats compact mode omitting seconds for hours", () => {
    expect(formatTimeRemaining(3661, true)).toBe("1h 1m");
  });

  it("compact mode still shows full format for minutes-only", () => {
    expect(formatTimeRemaining(125, true)).toBe("2m 5s");
  });

  it("compact mode still shows seconds-only format", () => {
    expect(formatTimeRemaining(30, true)).toBe("30s");
  });

  it("floors fractional seconds", () => {
    expect(formatTimeRemaining(59.9)).toBe("59s");
  });

  it("handles large values (24+ hours)", () => {
    const result = formatTimeRemaining(90061);
    expect(result).toBe("25h 1m 1s");
  });
});
