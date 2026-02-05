/**
 * Unit tests for Cloud Identity setting formatters.
 * Covers formatSettingType and formatSettingValue with all branching logic.
 */

import { describe, expect, it } from "bun:test";

import { formatSettingType, formatSettingValue } from "./formatters";

describe("formatSettingType", () => {
  it("returns empty string for empty input", () => {
    expect(formatSettingType("")).toBe("");
  });

  it("strips settings/ prefix before formatting", () => {
    const result = formatSettingType("settings/rule.dlp.upload");
    expect(result).toBe("Rule: Dlp Upload");
  });

  it("splits on dots and underscores", () => {
    expect(formatSettingType("chrome.users.SafeBrowsing")).toBe(
      "Chrome: Users SafeBrowsing"
    );
    expect(formatSettingType("rule_dlp_upload")).toBe("Rule: Dlp Upload");
  });

  it("capitalizes single-part names", () => {
    expect(formatSettingType("enrollment")).toBe("Enrollment");
  });

  it("formats multi-part Cloud Identity setting types", () => {
    expect(formatSettingType("rule.dlp.download")).toBe("Rule: Dlp Download");
    expect(formatSettingType("rule.dlp.clipboard")).toBe("Rule: Dlp Clipboard");
  });

  it("handles mixed dot and underscore separators", () => {
    expect(formatSettingType("chrome.devices_forced.reenrollment")).toBe(
      "Chrome: Devices Forced Reenrollment"
    );
  });

  it("handles input with only a prefix to strip", () => {
    expect(formatSettingType("settings/enrollment")).toBe("Enrollment");
  });
});

describe("formatSettingValue", () => {
  it("returns empty string for empty object", () => {
    expect(formatSettingValue({})).toBe("");
  });

  it("formats single entry as key: value", () => {
    expect(formatSettingValue({ action: "BLOCK" })).toBe("action: BLOCK");
  });

  it("formats boolean true as enabled", () => {
    expect(formatSettingValue({ enabled: true })).toBe("enabled: enabled");
  });

  it("formats boolean false as disabled", () => {
    expect(formatSettingValue({ monitoring: false })).toBe(
      "monitoring: disabled"
    );
  });

  it("formats up to 3 entries as comma-separated list", () => {
    const result = formatSettingValue({
      action: "AUDIT",
      trigger: "UPLOAD",
      enabled: true,
    });
    expect(result).toBe("action: AUDIT, trigger: UPLOAD, enabled: enabled");
  });

  it("returns count message for more than 3 entries", () => {
    const result = formatSettingValue({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    });
    expect(result).toBe("4 settings configured");
  });

  it("stringifies non-boolean, non-string values", () => {
    expect(formatSettingValue({ count: 42 })).toBe("count: 42");
    expect(formatSettingValue({ value: null })).toBe("value: null");
  });
});
