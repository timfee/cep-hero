import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, mock, spyOn, beforeEach } from "bun:test";

import AuthError from "@/app/(auth)/error";

describe("Auth error boundary component", () => {
  const mockReset = mock(() => {});
  const mockError = new Error("Auth test error") as Error & { digest?: string };

  beforeEach(() => {
    mockReset.mockClear();
  });

  it("renders auth-specific error message", () => {
    const { getByText } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    expect(getByText("Sign in failed")).toBeInTheDocument();
    expect(
      getByText(/We couldn't complete the sign in process/)
    ).toBeInTheDocument();
  });

  it("displays error digest when provided", () => {
    const errorWithDigest = new Error("Auth error") as Error & {
      digest?: string;
    };
    errorWithDigest.digest = "auth-digest-456";

    const { getByText } = render(
      <AuthError error={errorWithDigest} reset={mockReset} />
    );

    expect(getByText("Error ID: auth-digest-456")).toBeInTheDocument();
  });

  it("does not display error digest when not provided", () => {
    const { queryByText } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    expect(queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  it("calls reset function when Try again button is clicked", () => {
    const { getByRole } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    const button = getByRole("button", { name: /try again/i });
    fireEvent.click(button);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("renders Home link that navigates to root", () => {
    const { getByRole } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    const homeLink = getByRole("link", { name: /home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("logs authentication error to console on mount", () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

    render(<AuthError error={mockError} reset={mockReset} />);

    expect(consoleSpy).toHaveBeenCalledWith("Authentication error:", mockError);

    consoleSpy.mockRestore();
  });

  it("renders both Home and Try again buttons", () => {
    const { getByRole } = render(
      <AuthError error={mockError} reset={mockReset} />
    );

    expect(getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
