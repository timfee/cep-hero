/**
 * Tests for the rate limiting utility.
 */

import { describe, expect, it, beforeEach } from "bun:test";

import { checkRateLimit, getClientIp, timingSafeEqual } from "./rate-limit";

describe("rate-limit", () => {
  describe("checkRateLimit", () => {
    it("allows first request within limit", () => {
      const result = checkRateLimit({
        identifier: `test-${Date.now()}-1`,
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("tracks multiple requests from same identifier", () => {
      const identifier = `test-${Date.now()}-2`;

      const first = checkRateLimit({
        identifier,
        maxRequests: 3,
        windowMs: 60000,
      });
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(2);

      const second = checkRateLimit({
        identifier,
        maxRequests: 3,
        windowMs: 60000,
      });
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(1);

      const third = checkRateLimit({
        identifier,
        maxRequests: 3,
        windowMs: 60000,
      });
      expect(third.allowed).toBe(true);
      expect(third.remaining).toBe(0);
    });

    it("blocks requests after limit exceeded", () => {
      const identifier = `test-${Date.now()}-3`;

      for (let i = 0; i < 3; i++) {
        checkRateLimit({
          identifier,
          maxRequests: 3,
          windowMs: 60000,
        });
      }

      const blocked = checkRateLimit({
        identifier,
        maxRequests: 3,
        windowMs: 60000,
      });

      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("returns resetIn time for blocked requests", () => {
      const identifier = `test-${Date.now()}-4`;
      const windowMs = 60000;

      for (let i = 0; i < 3; i++) {
        checkRateLimit({
          identifier,
          maxRequests: 3,
          windowMs,
        });
      }

      const blocked = checkRateLimit({
        identifier,
        maxRequests: 3,
        windowMs,
      });

      expect(blocked.resetIn).toBeGreaterThan(0);
      expect(blocked.resetIn).toBeLessThanOrEqual(windowMs);
    });

    it("isolates different identifiers", () => {
      const id1 = `test-${Date.now()}-5a`;
      const id2 = `test-${Date.now()}-5b`;

      for (let i = 0; i < 3; i++) {
        checkRateLimit({
          identifier: id1,
          maxRequests: 3,
          windowMs: 60000,
        });
      }

      const blockedId1 = checkRateLimit({
        identifier: id1,
        maxRequests: 3,
        windowMs: 60000,
      });
      expect(blockedId1.allowed).toBe(false);

      const allowedId2 = checkRateLimit({
        identifier: id2,
        maxRequests: 3,
        windowMs: 60000,
      });
      expect(allowedId2.allowed).toBe(true);
    });
  });

  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("extracts IP from single x-forwarded-for value", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "203.0.113.50",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("203.0.113.50");
    });

    it("falls back to x-real-ip header", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-real-ip": "10.0.0.5",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("10.0.0.5");
    });

    it("prefers x-forwarded-for over x-real-ip", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "192.168.1.1",
          "x-real-ip": "10.0.0.5",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("returns hashed anonymous ID when no IP headers present", () => {
      const request = new Request("http://localhost");

      const ip = getClientIp(request);
      expect(ip).toMatch(/^anon-[a-f0-9]{16}$/);
    });
  });

  describe("timingSafeEqual", () => {
    it("returns true for equal strings", () => {
      expect(timingSafeEqual("password123", "password123")).toBe(true);
    });

    it("returns false for different strings", () => {
      expect(timingSafeEqual("password123", "password456")).toBe(false);
    });

    it("returns false for strings of different lengths", () => {
      expect(timingSafeEqual("short", "longer-string")).toBe(false);
    });

    it("returns true for empty strings", () => {
      expect(timingSafeEqual("", "")).toBe(true);
    });

    it("returns false for empty vs non-empty string", () => {
      expect(timingSafeEqual("", "something")).toBe(false);
    });
  });
});
