/**
 * Tests for the DashboardLoadContext.
 * Validates context provider defaults and fallback outside provider.
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
  const { isDashboardLoaded } = useDashboardLoad();
  return (
    <span data-testid="load-state">
      {isDashboardLoaded ? "loaded" : "loading"}
    </span>
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

  it("provides default values when used outside provider", () => {
    const { getByTestId } = render(<LoadStateDisplay />);

    expect(getByTestId("load-state").textContent).toBe("loading");
  });
});
