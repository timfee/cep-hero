/**
 * Tests for the SignInStatusPage component.
 * Validates authentication states and error handling.
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

// Import after mock.module to ensure the mock is used
import SignInStatusPage from "./page";

describe("SignInStatusPage component", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockPush.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows loading state initially", () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ authenticated: false }),
      })
    ) as typeof fetch;

    const { container, getByText } = render(<SignInStatusPage />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
    expect(getByText("Account Status")).toBeInTheDocument();
  });

  it("redirects to sign-in when unauthenticated", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ authenticated: false }),
      })
    ) as typeof fetch;

    render(<SignInStatusPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in");
    });
  });

  it("shows error status when there is an auth error", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            authenticated: true,
            user: { name: "Test", email: "test@example.com", image: null },
            error: "Token validation failed",
          }),
      })
    ) as typeof fetch;

    const { getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      // Error should be displayed, not redirected
      expect(getByText("Token validation failed")).toBeInTheDocument();
      expect(getByText("Error")).toBeInTheDocument();
    });
  });

  it("shows connection error when fetch throws an error", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Network error"))
    ) as typeof fetch;

    const { getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      // Should show error UI instead of redirecting
      expect(getByText("Connection Error")).toBeInTheDocument();
      expect(getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows user info and healthy status when authenticated", async () => {
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
              expiresIn: 3600,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
              scopes: ["email", "profile"],
            },
          }),
      })
    ) as typeof fetch;

    const { getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
      expect(getByText("test@example.com")).toBeInTheDocument();
      expect(getByText("Healthy")).toBeInTheDocument();
    });
  });

  it("shows warning status when token is expiring soon", async () => {
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
              expiresIn: 120,
              expiresAt: new Date(Date.now() + 120_000).toISOString(),
              scopes: [],
            },
          }),
      })
    ) as typeof fetch;

    const { getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      expect(getByText("Expiring Soon")).toBeInTheDocument();
    });
  });

  it("shows expired status when token has expired", async () => {
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
              expiresIn: 0,
              expiresAt: new Date().toISOString(),
              scopes: [],
            },
          }),
      })
    ) as typeof fetch;

    const { container, getByText } = render(<SignInStatusPage />);

    await waitFor(() => {
      // Check for the status label specifically
      const expiredLabel = getByText("Expired", { selector: "p" });
      expect(expiredLabel).toBeInTheDocument();
      // Also verify the destructive styling is applied
      const statusBadge = container.querySelector(
        String.raw`.bg-destructive\/10`
      );
      expect(statusBadge).toBeInTheDocument();
    });
  });

  it("shows sign out button", async () => {
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
              expiresIn: 3600,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
              scopes: [],
            },
          }),
      })
    ) as typeof fetch;

    const { getByRole } = render(<SignInStatusPage />);

    await waitFor(() => {
      const signOutButton = getByRole("button", { name: /sign out/i });
      expect(signOutButton).toBeInTheDocument();
    });
  });
});
