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

  it("renders branding and context", () => {
    const { getByText, getByAltText } = render(<SignInPage />);

    expect(getByText("CEP Hero")).toBeInTheDocument();
    expect(
      getByText("Internal POC playground for Chrome Enterprise")
    ).toBeInTheDocument();
    expect(getByAltText("CEP Hero")).toBeInTheDocument();
  });

  it("renders test domain explanation", () => {
    const { getByText, getAllByText } = render(<SignInPage />);

    expect(getByText(/test domain/i)).toBeInTheDocument();
    expect(getAllByText(/cep-netnew\.cc/i).length).toBeGreaterThan(0);
  });

  it("renders side-by-side sign-in and sign-up cards", () => {
    const { getByText } = render(<SignInPage />);

    expect(getByText("Sign In")).toBeInTheDocument();
    expect(getByText("Get an Account")).toBeInTheDocument();
    expect(
      getByText(/already have a cep-netnew\.cc account/i)
    ).toBeInTheDocument();
  });

  it("renders sign-in button", () => {
    const { getByRole } = render(<SignInPage />);

    const button = getByRole("button", {
      name: /sign in with cep-netnew\.cc/i,
    });
    expect(button).toBeInTheDocument();
  });

  it("calls signIn.social on button click", () => {
    const { getByRole } = render(<SignInPage />);

    fireEvent.click(
      getByRole("button", { name: /sign in with cep-netnew\.cc/i })
    );
    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/",
    });
  });

  it("shows Chrome profile tip", () => {
    const { getByText } = render(<SignInPage />);

    expect(getByText(/separate chrome profile/i)).toBeInTheDocument();
  });

  it("renders enrollment form fields", () => {
    const { getByLabelText, getByRole } = render(<SignInPage />);

    expect(getByLabelText("Full Name")).toBeInTheDocument();
    expect(getByLabelText("Google Email")).toBeInTheDocument();
    expect(getByLabelText("Enrollment Password")).toBeInTheDocument();
    expect(
      getByRole("button", { name: /request account/i })
    ).toBeInTheDocument();
  });
});
