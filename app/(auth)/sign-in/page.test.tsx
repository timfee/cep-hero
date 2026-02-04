import { fireEvent, render } from "@testing-library/react";
/* oxlint-disable typescript/no-unsafe-call, eslint-plugin-next/no-img-element, eslint-plugin-jest/require-hook, eslint-plugin-import/first, eslint-plugin-import/no-duplicates, no-empty-function, no-duplicate-imports */
import { beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * Mock placeholder function for testing.
 */
function noop() {
  // Intentionally empty mock implementation
}

// Mock next/image
mock.module("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    <img alt={alt} {...props} />
  ),
}));

// Mock next/navigation
mock.module("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
  useRouter: () => ({
    push: mock(noop),
    refresh: mock(noop),
  }),
}));

// Mock vercel analytics
const mockTrack = mock(noop);
mock.module("@vercel/analytics", () => ({
  track: mockTrack,
}));

// Mock the entire auth-client module to avoid BetterAuth initialization
const mockSignInSocial = mock(noop);
const mockSignOut = mock(noop);
const mockSignUp = mock(noop);
mock.module("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: mockSignInSocial },
    signOut: mockSignOut,
    signUp: mockSignUp,
    useSession: () => ({ data: null, isPending: false }),
  },
  signIn: { social: mockSignInSocial },
  signOut: mockSignOut,
  signUp: mockSignUp,
  useSession: () => ({ data: null, isPending: false }),
}));

const { default: SignInPage } = await import("./page");

describe("SignInPage", () => {
  beforeEach(() => {
    mockSignInSocial.mockClear();
    mockTrack.mockClear();
  });

  it("renders branding", () => {
    const { getByText, getByAltText } = render(<SignInPage />);

    expect(getByText("CEP Hero")).toBeInTheDocument();
    expect(
      getByText("Chrome Enterprise Premium diagnostics")
    ).toBeInTheDocument();
    expect(getByAltText("CEP Hero")).toBeInTheDocument();
  });

  it("renders sign-in button", () => {
    const { getByRole } = render(<SignInPage />);

    const button = getByRole("button", { name: /continue with google/i });
    expect(button).toBeInTheDocument();
  });

  it("calls signIn.social on button click", () => {
    const { getByRole } = render(<SignInPage />);

    fireEvent.click(getByRole("button", { name: /continue with google/i }));
    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/",
    });
  });

  it("shows admin account requirement text", () => {
    const { getByText } = render(<SignInPage />);

    expect(
      getByText(/requires a google workspace admin account/i)
    ).toBeInTheDocument();
  });
});
