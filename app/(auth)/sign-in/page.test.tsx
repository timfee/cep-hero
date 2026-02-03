/* oxlint-disable typescript/no-unsafe-call, eslint-plugin-next/no-img-element, eslint-plugin-jest/require-hook */
import { mock } from "bun:test";

// Mock next/image
mock.module("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    <img alt={alt} {...props} />
  ),
}));

// Mock vercel analytics
const mockTrack = mock(() => {});
mock.module("@vercel/analytics", () => ({
  track: mockTrack,
}));

// Mock the entire auth-client module to avoid BetterAuth initialization
const mockSignInSocial = mock(() => {});
mock.module("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: mockSignInSocial },
    signOut: mock(() => {}),
    signUp: mock(() => {}),
    useSession: () => ({ data: null, isPending: false }),
  },
  signIn: { social: mockSignInSocial },
  signOut: mock(() => {}),
  signUp: mock(() => {}),
  useSession: () => ({ data: null, isPending: false }),
}));

// Import after mocking
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";

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
