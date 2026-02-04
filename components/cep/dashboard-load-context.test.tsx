/**
 * Tests for the DashboardLoadContext.
 * Validates context provider and hook behavior.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import {
  DashboardLoadProvider,
  useDashboardLoad,
} from "./dashboard-load-context";

/**
 * Test component that displays the current load state.
 */
function LoadStateDisplay() {
  const { isDashboardLoaded, setDashboardLoaded } = useDashboardLoad();
  return (
    <div>
      <span data-testid="load-state">
        {isDashboardLoaded ? "loaded" : "loading"}
      </span>
      <span data-testid="has-setter">{typeof setDashboardLoaded}</span>
    </div>
  );
}

describe("DashboardLoadContext", () => {
  it("provides default loading state as false", () => {
    const { getByTestId } = render(
      <DashboardLoadProvider>
        <LoadStateDisplay />
      </DashboardLoadProvider>
    );

    expect(getByTestId("load-state").textContent).toBe("loading");
  });

  it("provides setDashboardLoaded function", () => {
    const { getByTestId } = render(
      <DashboardLoadProvider>
        <LoadStateDisplay />
      </DashboardLoadProvider>
    );

    expect(getByTestId("has-setter").textContent).toBe("function");
  });

  it("provides default values when used outside provider", () => {
    const { getByTestId } = render(<LoadStateDisplay />);

    // Should render with default value (false -> "loading")
    expect(getByTestId("load-state").textContent).toBe("loading");
    // Setter should still be a function (noop)
    expect(getByTestId("has-setter").textContent).toBe("function");
  });

  it("renders children correctly", () => {
    const { getByTestId } = render(
      <DashboardLoadProvider>
        <div data-testid="child">Child content</div>
      </DashboardLoadProvider>
    );

    expect(getByTestId("child").textContent).toBe("Child content");
  });
});
