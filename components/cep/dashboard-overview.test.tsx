/**
 * Tests for the DashboardOverview component.
 * Validates shimmer loading states and content rendering.
 */

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, mock, afterEach } from "bun:test";

// Mock useSWR
const mockMutate = mock(() => Promise.resolve());
let mockSWRReturn = {
  data: null,
  error: null,
  isLoading: true,
  isValidating: false,
  mutate: mockMutate,
};

mock.module("swr", () => ({
  default: () => mockSWRReturn,
}));

// Mock Vercel analytics
mock.module("@vercel/analytics", () => ({
  track: mock(() => Promise.resolve()),
}));

// Mock useDashboardLoad
const mockSetDashboardLoaded = mock(() => {});
mock.module("./dashboard-load-context", () => ({
  useDashboardLoad: () => ({
    isDashboardLoaded: false,
    setDashboardLoaded: mockSetDashboardLoaded,
  }),
}));

import { DashboardOverview } from "./dashboard-overview";

describe("DashboardOverview component", () => {
  const mockOnAction = mock(() => {});

  afterEach(() => {
    mockOnAction.mockClear();
    mockMutate.mockClear();
    mockSetDashboardLoaded.mockClear();
  });

  it("shows skeleton shimmer during initial loading", () => {
    mockSWRReturn = {
      data: null,
      error: null,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    };

    const { container } = render(<DashboardOverview onAction={mockOnAction} />);

    // Check for skeleton shimmer elements
    const shimmerElements = container.querySelectorAll(".overflow-hidden");
    expect(shimmerElements.length).toBeGreaterThan(0);
  });

  it("shows text shimmer when data has no summary content", async () => {
    mockSWRReturn = {
      data: {
        headline: "",
        summary: "",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(<DashboardOverview onAction={mockOnAction} />);

    // Should show the shimmer text since summary is empty
    await waitFor(() => {
      expect(getByText("Analyzing your fleet")).toBeInTheDocument();
    });
  });

  it("shows actual content when summary has text", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status: Healthy",
        summary: "All systems are operating normally.",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(<DashboardOverview onAction={mockOnAction} />);

    await waitFor(() => {
      expect(getByText("Fleet Status: Healthy")).toBeInTheDocument();
      expect(
        getByText("All systems are operating normally.")
      ).toBeInTheDocument();
    });
  });

  it("shows shimmer during refresh even with existing data", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status: Healthy",
        summary: "All systems are operating normally.",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: true, // Validating/refreshing
      mutate: mockMutate,
    };

    const { getByText } = render(<DashboardOverview onAction={mockOnAction} />);

    // Should show shimmer text during validation
    await waitFor(() => {
      expect(getByText("Analyzing your fleet")).toBeInTheDocument();
    });
  });

  it("shows error state when fetch fails", async () => {
    mockSWRReturn = {
      data: null,
      error: new Error("Failed to fetch"),
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(<DashboardOverview onAction={mockOnAction} />);

    await waitFor(() => {
      expect(getByText("Failed to load")).toBeInTheDocument();
    });
  });

  it("renders posture cards when available", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Some devices need attention.",
        postureCards: [
          {
            label: "Security Events",
            value: "5 events",
            note: "Review needed",
            source: "Chrome Events API",
            action: "Show security events",
            status: "warning",
            priority: 1,
          },
        ],
        suggestions: [],
        sources: ["Chrome Events API"],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(<DashboardOverview onAction={mockOnAction} />);

    await waitFor(() => {
      expect(getByText("Security Events")).toBeInTheDocument();
      expect(getByText("5 events")).toBeInTheDocument();
      expect(getByText("Fleet posture")).toBeInTheDocument();
    });
  });

  it("renders suggestions when available", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Some recommendations available.",
        postureCards: [],
        suggestions: [
          {
            text: "Enable DLP monitoring",
            action: "Help me set up DLP",
            priority: 1,
            category: "security",
          },
        ],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(<DashboardOverview onAction={mockOnAction} />);

    await waitFor(() => {
      expect(getByText("Enable DLP monitoring")).toBeInTheDocument();
      expect(getByText("Recommended actions")).toBeInTheDocument();
    });
  });

  it("shows all healthy message when no cards or suggestions", async () => {
    mockSWRReturn = {
      data: {
        headline: "All Clear",
        summary: "Everything is healthy.",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByText } = render(<DashboardOverview onAction={mockOnAction} />);

    await waitFor(() => {
      expect(getByText("All systems healthy")).toBeInTheDocument();
      expect(getByText("No issues require your attention")).toBeInTheDocument();
    });
  });

  it("calls setDashboardLoaded when content loads", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "Dashboard loaded with content.",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    render(<DashboardOverview onAction={mockOnAction} />);

    await waitFor(() => {
      expect(mockSetDashboardLoaded).toHaveBeenCalledWith(true);
    });
  });

  it("does not call setDashboardLoaded when still loading", async () => {
    mockSWRReturn = {
      data: null,
      error: null,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    };

    render(<DashboardOverview onAction={mockOnAction} />);

    // Give effect time to run
    await waitFor(() => {
      expect(mockSetDashboardLoaded).not.toHaveBeenCalled();
    });
  });
});
