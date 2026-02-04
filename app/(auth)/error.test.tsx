/* oxlint-disable typescript/no-unsafe-call */
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";

import AuthError from "./error";

let resetCalls: number;

function mockReset() {
  resetCalls += 1;
}

describe("AuthError", () => {
  const mockError = new Error("Auth test error") as Error & { digest?: string };

  beforeEach(() => {
    resetCalls = 0;
  });

  it("renders error message", () => {
    const { getByText } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    expect(getByText("Sign in failed")).toBeInTheDocument();
    expect(getByText(/Unable to complete sign in/)).toBeInTheDocument();
  });

  it("displays error digest when provided", () => {
    const errorWithDigest = new Error("Auth error") as Error & {
      digest?: string;
    };
    errorWithDigest.digest = "auth-digest-456";

    const { getByText } = render(
      <AuthError error={errorWithDigest} reset={mockReset} />
    );

    expect(getByText("Error: auth-digest-456")).toBeInTheDocument();
  });

  it("hides digest when not provided", () => {
    const { queryByText } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    expect(queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it("calls reset on try again click", () => {
    const { getByRole } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    fireEvent.click(getByRole("button", { name: /try again/i }));
    expect(resetCalls).toBe(1);
  });

  it("renders home link to root", () => {
    const { getByRole } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    const homeLink = getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
