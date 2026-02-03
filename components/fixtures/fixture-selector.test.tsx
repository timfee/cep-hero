import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, mock } from "bun:test";

import { FixtureProvider } from "@/lib/fixtures/context";

import { FixtureSelector } from "./fixture-selector";

function renderWithProvider(ui: React.ReactNode) {
  return render(<FixtureProvider>{ui}</FixtureProvider>);
}

describe("FixtureSelector", () => {
  beforeEach(() => {
    // Mock fetch to return fixture list with ok: true
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            fixtures: [
              {
                id: "EC-001",
                title: "Network connectivity",
                category: "enrollment",
                tags: ["network"],
              },
              {
                id: "EC-002",
                title: "Error codes",
                category: "enrollment",
                tags: ["errors"],
              },
            ],
            categories: ["enrollment", "policy"],
            total: 2,
          }),
      })
    ) as unknown as typeof fetch;
  });

  it("renders without crashing", () => {
    const { container } = renderWithProvider(<FixtureSelector />);
    expect(container).toBeDefined();
  });

  it("fetches fixtures on mount", async () => {
    renderWithProvider(<FixtureSelector />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/fixtures");
    });
  });

  it("renders combobox after loading", async () => {
    const { container } = renderWithProvider(<FixtureSelector />);

    await waitFor(() => {
      const combobox = container.querySelector('[role="combobox"]');
      expect(combobox).not.toBeNull();
    });
  });

  it("shows error state when fetch fails", async () => {
    // Override mock to simulate failure
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      })
    ) as unknown as typeof fetch;

    const { container } = renderWithProvider(<FixtureSelector />);

    await waitFor(() => {
      const errorText = container.querySelector(".text-destructive");
      expect(errorText).not.toBeNull();
      expect(errorText?.textContent).toBe("Error loading");
    });
  });
});
