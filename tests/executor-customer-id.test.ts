/**
 * Unit tests for CepToolExecutor customer ID resolution.
 * Tests the logic for resolving actual customer IDs for Cloud Identity API.
 */

import { describe, expect, it, mock, spyOn } from "bun:test";
import { google as googleApis } from "googleapis";

import { CepToolExecutor } from "@/lib/mcp/registry";

describe("CepToolExecutor customer ID resolution", () => {
  it("uses provided customer ID directly when not my_customer", async () => {
    // When a specific customer ID is provided, it should be used directly
    // without any API call to resolve it
    const executor = new CepToolExecutor("fake-token", "C12345");

    // The executor should use the provided ID without calling the Chrome Policy API
    // We can verify this by checking that no API calls are made
    const policySpy = spyOn(googleApis, "chromepolicy");

    // Access the private method via prototype trick for testing
    const resolveCustomerId = (
      executor as unknown as {
        resolveCustomerId: () => Promise<string>;
      }
    ).resolveCustomerId.bind(executor);

    const result = await resolveCustomerId();
    expect(result).toBe("C12345");
    expect(policySpy).not.toHaveBeenCalled();

    policySpy.mockRestore();
  });

  it("resolves customer ID from policy schema when using my_customer", async () => {
    // Mock the Chrome Policy API response
    const mockPolicySchemas = {
      list: mock(() =>
        Promise.resolve({
          data: {
            policySchemas: [
              {
                name: "customers/C98765/policySchemas/chrome.users.SafeBrowsing",
              },
            ],
          },
        })
      ),
    };

    const mockChromepolicy = mock(() => ({
      customers: {
        policySchemas: mockPolicySchemas,
      },
    }));

    const originalChromepolicy = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockChromepolicy as unknown as typeof googleApis.chromepolicy;

    try {
      const executor = new CepToolExecutor("fake-token", "my_customer");

      const resolveCustomerId = (
        executor as unknown as {
          resolveCustomerId: () => Promise<string>;
        }
      ).resolveCustomerId.bind(executor);

      const result = await resolveCustomerId();
      expect(result).toBe("C98765");
      expect(mockPolicySchemas.list).toHaveBeenCalledWith({
        parent: "customers/my_customer",
        pageSize: 1,
      });
    } finally {
      googleApis.chromepolicy = originalChromepolicy;
    }
  });

  it("throws error when resolution fails (no silent fallback)", async () => {
    // Mock the Chrome Policy API to throw an error
    const mockPolicySchemas = {
      list: mock(() => Promise.reject(new Error("API error"))),
    };

    const mockChromepolicy = mock(() => ({
      customers: {
        policySchemas: mockPolicySchemas,
      },
    }));

    const originalChromepolicy = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockChromepolicy as unknown as typeof googleApis.chromepolicy;

    try {
      const executor = new CepToolExecutor("fake-token", "my_customer");

      const resolveCustomerId = (
        executor as unknown as {
          resolveCustomerId: () => Promise<string>;
        }
      ).resolveCustomerId.bind(executor);

      // Should throw an error, not silently fall back to my_customer
      await expect(resolveCustomerId()).rejects.toThrow(
        "Failed to resolve customer ID"
      );
    } finally {
      googleApis.chromepolicy = originalChromepolicy;
    }
  });

  it("throws error when policy schema has no extractable customer ID", async () => {
    // Mock empty policy schema response (no name field to extract ID from)
    const mockPolicySchemas = {
      list: mock(() =>
        Promise.resolve({
          data: {
            policySchemas: [{}],
          },
        })
      ),
    };

    const mockChromepolicy = mock(() => ({
      customers: {
        policySchemas: mockPolicySchemas,
      },
    }));

    const originalChromepolicy = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockChromepolicy as unknown as typeof googleApis.chromepolicy;

    try {
      const executor = new CepToolExecutor("fake-token", "my_customer");

      const resolveCustomerId = (
        executor as unknown as {
          resolveCustomerId: () => Promise<string>;
        }
      ).resolveCustomerId.bind(executor);

      // Should throw when no customer ID can be extracted
      await expect(resolveCustomerId()).rejects.toThrow(
        "Failed to resolve customer ID"
      );
    } finally {
      googleApis.chromepolicy = originalChromepolicy;
    }
  });

  it("caches resolved customer ID within same executor instance", async () => {
    const mockPolicySchemas = {
      list: mock(() =>
        Promise.resolve({
          data: {
            policySchemas: [
              {
                name: "customers/C11111/policySchemas/chrome.users.SafeBrowsing",
              },
            ],
          },
        })
      ),
    };

    const mockChromepolicy = mock(() => ({
      customers: {
        policySchemas: mockPolicySchemas,
      },
    }));

    const originalChromepolicy = googleApis.chromepolicy;
    googleApis.chromepolicy =
      mockChromepolicy as unknown as typeof googleApis.chromepolicy;

    try {
      const executor = new CepToolExecutor("fake-token", "my_customer");

      const resolveCustomerId = (
        executor as unknown as {
          resolveCustomerId: () => Promise<string>;
        }
      ).resolveCustomerId.bind(executor);

      // Call resolve multiple times
      const result1 = await resolveCustomerId();
      const result2 = await resolveCustomerId();
      const result3 = await resolveCustomerId();

      expect(result1).toBe("C11111");
      expect(result2).toBe("C11111");
      expect(result3).toBe("C11111");

      // API should only be called once due to caching
      expect(mockPolicySchemas.list).toHaveBeenCalledTimes(1);
    } finally {
      googleApis.chromepolicy = originalChromepolicy;
    }
  });
});
