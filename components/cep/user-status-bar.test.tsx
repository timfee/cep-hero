/**
 * Tests for the UserStatusBar component.
 * Validates authentication states and branding display.
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

// Mock Next.js Image component to avoid URL validation issues in tests
mock.module("next/image", () => ({
  default: function MockImage({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
  }) {
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Import after mock.module to ensure the mock is used
import { UserStatusBar } from "./user-status-bar";

describe("UserStatusBar component", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockPush.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows loading state with branding", () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ authenticated: false }),
      })
    ) as typeof fetch;

    const { container, getByText } = render(<UserStatusBar />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
    expect(getByText("CEP Hero")).toBeInTheDocument();
  });

  it("shows not signed in with branding when unauthenticated", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ authenticated: false }),
      })
    ) as typeof fetch;

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Not signed in")).toBeInTheDocument();
      expect(getByText("CEP Hero")).toBeInTheDocument();
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
      expect(getByText("CEP Hero")).toBeInTheDocument();
    });
  });

  it("shows healthy status indicator when token is valid", async () => {
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

    const { container, getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
    });

    // Check for healthy status indicator (green background)
    const statusIndicator = container.querySelector(".bg-emerald-500\\/10");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("shows warning status indicator when token is expiring soon", async () => {
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
              expiresIn: 120, // Less than 5 minutes
              expiresAt: new Date(Date.now() + 120000).toISOString(),
              scopes: [],
            },
          }),
      })
    ) as typeof fetch;

    const { container, getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
    });

    // Check for warning status indicator (yellow background)
    const statusIndicator = container.querySelector(".bg-yellow-500\\/10");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("shows expired status indicator when token has expired", async () => {
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

    const { container, getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
    });

    // Check for expired status indicator (red background)
    const statusIndicator = container.querySelector(".bg-destructive\\/10");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("shows countdown timer icon in trigger button", async () => {
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

    const { container, getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
    });

    // Check that the trigger button contains the clock icon container
    const clockContainer = container.querySelector(".rounded-full.size-8");
    expect(clockContainer).toBeInTheDocument();
  });

  it("renders dropdown trigger with proper aria-label", async () => {
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

    const { getByRole } = render(<UserStatusBar />);

    await waitFor(() => {
      const trigger = getByRole("button", {
        name: /Account menu for Test User/i,
      });
      expect(trigger).toBeInTheDocument();
    });
  });
});
