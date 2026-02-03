import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, mock, beforeEach } from "bun:test";

import { FixtureProvider } from "@/lib/fixtures/context";

import { FixtureSelector } from "./fixture-selector";

function renderWithProvider(ui: React.ReactNode) {
  return render(<FixtureProvider>{ui}</FixtureProvider>);
}

describe("FixtureSelector", () => {
  beforeEach(() => {
    // Mock fetch to return fixture list
    globalThis.fetch = mock(() =>
      Promise.resolve({
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
      expect(combobox).toBeInTheDocument();
    });
  });
});
