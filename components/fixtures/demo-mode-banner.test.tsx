import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "bun:test";
import { useEffect } from "react";

import { FixtureProvider, useFixtureContext } from "@/lib/fixtures/context";

import { DemoModeBanner } from "./demo-mode-banner";

function renderWithProvider(ui: React.ReactNode) {
  return render(<FixtureProvider>{ui}</FixtureProvider>);
}

/**
 * Helper component that activates a fixture via context for testing.
 */
function FixtureActivator({
  fixture,
  children,
}: {
  fixture: {
    id: string;
    title: string;
    category: string;
    data: Record<string, unknown>;
  };
  children: React.ReactNode;
}) {
  const { setActiveFixture } = useFixtureContext();

  useEffect(() => {
    setActiveFixture(fixture);
  }, [setActiveFixture, fixture]);

  return <>{children}</>;
}

describe("DemoModeBanner", () => {
  it("renders nothing when not in fixture mode (initial state)", () => {
    const { container } = renderWithProvider(<DemoModeBanner />);
    // The banner returns null when no fixture is active
    const banner = container.querySelector('[class*="border-amber"]');
    expect(banner).toBeNull();
  });

  it("renders banner with fixture title when fixture is active", async () => {
    const testFixture = {
      id: "EC-001",
      title: "Network connectivity during enrollment",
      category: "enrollment",
      data: {},
    };

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <FixtureProvider>
          <FixtureActivator fixture={testFixture}>
            <DemoModeBanner />
          </FixtureActivator>
        </FixtureProvider>
      );
      container = result.container;
    });

    // Verify the banner is displayed using container queries
    expect(container!.textContent).toContain("Demo Mode:");
    expect(container!.textContent).toContain(
      "Network connectivity during enrollment"
    );
    expect(container!.textContent).toContain("enrollment");
  });

  it("clears fixture when exit button is clicked", async () => {
    const testFixture = {
      id: "EC-001",
      title: "Test Fixture",
      category: "test",
      data: {},
    };

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <FixtureProvider>
          <FixtureActivator fixture={testFixture}>
            <DemoModeBanner />
          </FixtureActivator>
        </FixtureProvider>
      );
      container = result.container;
    });

    // Verify banner is shown
    expect(container!.textContent).toContain("Demo Mode:");

    // Click exit button
    const exitButton = container!.querySelector("button");
    expect(exitButton).not.toBeNull();
    await userEvent.click(exitButton!);

    // Verify banner is gone
    expect(container!.textContent).not.toContain("Demo Mode:");
  });

  it("displays the category badge", async () => {
    const testFixture = {
      id: "EC-005",
      title: "Policy not applying",
      category: "policy",
      data: {},
    };

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <FixtureProvider>
          <FixtureActivator fixture={testFixture}>
            <DemoModeBanner />
          </FixtureActivator>
        </FixtureProvider>
      );
      container = result.container;
    });

    // Check category badge exists
    const categoryBadge = container!.querySelector('[class*="rounded-full"]');
    expect(categoryBadge).not.toBeNull();
    expect(categoryBadge!.textContent).toBe("policy");
  });
});
