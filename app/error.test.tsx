/**
 * Tests for the global error boundary component.
 * Verifies error display, user interactions, and logging behavior.
 */

import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, mock, spyOn, beforeEach } from "bun:test";

import ErrorBoundary from "@/app/error";

describe("Error boundary component", () => {
  const mockReset = mock(() => {});
  const mockError = new Error("Test error message") as Error & {
    digest?: string;
  };

  beforeEach(() => {
    mockReset.mockClear();
  });

  it("renders error message", () => {
    const { getByText } = render(
      <ErrorBoundary error={mockError} reset={mockReset} />
    );

    expect(getByText("Something went wrong")).toBeInTheDocument();
    expect(
      getByText(
        "An unexpected error occurred. Please try again or contact support if the problem persists."
      )
    ).toBeInTheDocument();
  });

  it("displays error digest when provided", () => {
    const errorWithDigest = new Error("Test error") as Error & {
      digest?: string;
    };
    errorWithDigest.digest = "abc123";

    const { getByText } = render(
      <ErrorBoundary error={errorWithDigest} reset={mockReset} />
    );

    expect(getByText("Error ID: abc123")).toBeInTheDocument();
  });

  it("does not display error digest when not provided", () => {
    const { queryByText } = render(
      <ErrorBoundary error={mockError} reset={mockReset} />
    );

    expect(queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  it("calls reset function when Try again button is clicked", () => {
    const { getByRole } = render(
      <ErrorBoundary error={mockError} reset={mockReset} />
    );

    const button = getByRole("button", { name: /try again/i });
    fireEvent.click(button);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs error to console on mount", () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

    render(<ErrorBoundary error={mockError} reset={mockReset} />);

    expect(consoleSpy).toHaveBeenCalledWith("Application error:", mockError);

    consoleSpy.mockRestore();
  });
});
