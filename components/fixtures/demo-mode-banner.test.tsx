import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

import { FixtureProvider } from "@/lib/fixtures/context";

import { DemoModeBanner } from "./demo-mode-banner";

function renderWithProvider(ui: React.ReactNode) {
  return render(<FixtureProvider>{ui}</FixtureProvider>);
}

describe("DemoModeBanner", () => {
  it("renders nothing when not in fixture mode (initial state)", () => {
    const { container } = renderWithProvider(<DemoModeBanner />);
    // The banner returns null when no fixture is active
    // Container has a wrapper div, but the banner itself is null
    const banner = container.querySelector('[class*="border-amber"]');
    expect(banner).toBeNull();
  });

  it("renders without crashing", () => {
    const { container } = renderWithProvider(<DemoModeBanner />);
    expect(container).toBeDefined();
  });
});
