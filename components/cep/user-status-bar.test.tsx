import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";

import { UserStatusBar } from "./user-status-bar";

const mockPush = mock(() => {});

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mock(() => {}),
  }),
}));

describe("UserStatusBar component", () => {
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
        json: () => Promise.resolve({ authenticated: false }),
      })
    ) as typeof fetch;

    const { container } = render(<UserStatusBar />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("shows not signed in when unauthenticated", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ authenticated: false }),
      })
    ) as typeof fetch;

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Not signed in")).toBeInTheDocument();
    });
  });

  it("shows user info when authenticated", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
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
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              scopes: ["email", "profile"],
            },
          }),
      })
    ) as typeof fetch;

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
    });
  });

  it("shows time remaining for token", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
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
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              scopes: [],
            },
          }),
      })
    ) as typeof fetch;

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("1h 0m")).toBeInTheDocument();
    });
  });

  it("shows expired status when token has expired", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
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

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Expired")).toBeInTheDocument();
    });
  });

  it("shows token error when there is an error", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            authenticated: true,
            user: {
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
            error: "Token validation failed",
          }),
      })
    ) as typeof fetch;

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Token error")).toBeInTheDocument();
    });
  });

  it("displays user initials when no image", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
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
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              scopes: [],
            },
          }),
      })
    ) as typeof fetch;

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("TU")).toBeInTheDocument();
    });
  });
});
