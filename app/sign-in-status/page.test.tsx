/**
 * Tests for the SignInStatusPage component.
 * Validates page-specific display: user info details, token status labels,
 * and sign-out button. Auth redirect behavior is covered by user-status-bar tests.
 */

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";

const mockPush = mock(() => {});

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mock(() => {}),
  }),
}));

import SignInStatusPage from "./page";

/**
 * Builds a mock fetch that returns an authenticated response.
 */
function mockAuthenticatedFetch(tokenOverrides?: {
  expiresIn?: number;
  expiresAt?: string;
}) {
  const expiresIn = tokenOverrides?.expiresIn ?? 3600;
  const expiresAt =
    tokenOverrides?.expiresAt ??
    new Date(Date.now() + expiresIn * 1000).toISOString();

  globalThis.fetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          authenticated: true,
          user: {
            name: "Test User",
            email: "test@example.com",
            image: null,
          },
          token: {
            expiresIn,
            expiresAt,
            scopes: ["email", "profile"],
          },
        }),
    })
  ) as unknown as typeof fetch;
}

describe("SignInStatusPage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockPush.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows user info and healthy status when authenticated", async () => {
    mockAuthenticatedFetch();

    const { getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
      expect(getByText("test@example.com")).toBeInTheDocument();
      expect(getByText("Healthy")).toBeInTheDocument();
    });
  });

  it("shows warning status when token is expiring soon", async () => {
    mockAuthenticatedFetch({ expiresIn: 120 });

    const { getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      expect(getByText("Expiring Soon")).toBeInTheDocument();
    });
  });

  it("shows expired status when token has expired", async () => {
    mockAuthenticatedFetch({ expiresIn: 0 });

    const { getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      const expiredLabel = getByText("Expired", { selector: "p" });
      expect(expiredLabel).toBeInTheDocument();
    });
  });

  it("shows sign out button", async () => {
    mockAuthenticatedFetch();

    const { getByRole } = render(<SignInStatusPage />);

    await waitFor(() => {
      const signOutButton = getByRole("button", { name: /sign out/i });
      expect(signOutButton).toBeInTheDocument();
    });
  });
});
