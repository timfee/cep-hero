/**
 * Tests for the UserStatusBar component.
 * Validates authentication states, redirect behavior, and branding display.
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

import { UserStatusBar } from "./user-status-bar";

/**
 * Builds a mock fetch returning an authenticated response with configurable token.
 */
function mockAuthFetch(tokenOverrides?: {
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
          token: { expiresIn, expiresAt, scopes: ["email", "profile"] },
        }),
    })
  ) as unknown as typeof fetch;
}

/**
 * Builds a mock fetch returning an unauthenticated response.
 */
function mockUnauthFetch() {
  globalThis.fetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ authenticated: false }),
    })
  ) as unknown as typeof fetch;
}

describe("UserStatusBar component", () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  let locationHref = "";

  beforeEach(() => {
    mockPush.mockClear();
    locationHref = "";
    const locationMock = { ...originalLocation };
    Object.defineProperty(locationMock, "href", {
      get() {
        return locationHref;
      },
      set(value: string) {
        locationHref = value;
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "location", {
      value: locationMock,
      writable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  it("shows branding during loading", () => {
    mockUnauthFetch();

    const { getByText } = render(<UserStatusBar />);

    expect(getByText("CEP Hero")).toBeInTheDocument();
  });

  it("redirects to sign-in when unauthenticated", async () => {
    mockUnauthFetch();

    render(<UserStatusBar />);

    await waitFor(() => {
      expect(locationHref).toBe("/sign-in");
    });
  });

  it("redirects to sign-in when auth response contains error", async () => {
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
    ) as unknown as typeof fetch;

    render(<UserStatusBar />);

    await waitFor(() => {
      expect(locationHref).toBe("/sign-in");
    });
  });

  it("redirects to sign-in on network failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Network error"))
    ) as unknown as typeof fetch;

    render(<UserStatusBar />);

    await waitFor(() => {
      expect(locationHref).toBe("/sign-in");
    });
  });

  it("shows user name when authenticated", async () => {
    mockAuthFetch();

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("Test User")).toBeInTheDocument();
    });
  });

  it("shows countdown time for valid token", async () => {
    mockAuthFetch();

    const { getByText } = render(<UserStatusBar />);

    await waitFor(() => {
      expect(getByText("1h 0m")).toBeInTheDocument();
    });
  });

  it("renders dropdown trigger with proper aria-label", async () => {
    mockAuthFetch();

    const { getByRole } = render(<UserStatusBar />);

    await waitFor(() => {
      const trigger = getByRole("button", {
        name: /Account menu for Test User/i,
      });
      expect(trigger).toBeInTheDocument();
    });
  });
});
