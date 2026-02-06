/**
 * Tests for the DashboardOverview component.
 * Validates shimmer loading states, content rendering, and the contract
 * that the chat welcome message never duplicates dashboard text.
 */

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, mock, afterEach } from "bun:test";

/**
 * Dashboard data structure for mock SWR responses.
 */
interface MockDashboardData {
  headline: string;
  summary: string;
  postureCards: Array<{
    label: string;
    value: string;
    note: string;
    source: string;
    action: string;
    status: string;
    priority: number;
  }>;
  suggestions: Array<{
    text: string;
    action: string;
    priority: number;
    category: string;
  }>;
  sources: string[];
}

/**
 * Mock SWR return type for dashboard tests.
 */
interface MockSWRReturn {
  data: MockDashboardData | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: typeof mockMutate;
}

// Mock useSWR
const mockMutate = mock(() => Promise.resolve());
let mockSWRReturn: MockSWRReturn = {
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

import type { FleetOverviewFacts } from "@/lib/mcp/fleet-overview/types";
import type { OverviewData } from "@/lib/overview";

import { generateWelcomeMessage } from "@/components/chat/welcome-message";
import { buildFallbackOverview } from "@/lib/mcp/fleet-overview/summarize";

import { DashboardOverview } from "./dashboard-overview";

/**
 * Fleet facts fixtures representing common real-world states.
 */
const FLEET_SCENARIOS: Record<string, FleetOverviewFacts> = {
  allMissing: {
    eventCount: 0,
    blockedEventCount: 0,
    errorEventCount: 0,
    dlpRuleCount: 0,
    connectorPolicyCount: 0,
    latestEventAt: null,
    eventWindowLabel: "7 days",
    eventSampled: false,
    eventSampleCount: 0,
    errors: [],
  },
  allHealthy: {
    eventCount: 100,
    blockedEventCount: 5,
    errorEventCount: 2,
    dlpRuleCount: 3,
    connectorPolicyCount: 2,
    latestEventAt: "2026-01-07T12:00:00Z",
    eventWindowLabel: "7 days",
    eventSampled: false,
    eventSampleCount: 100,
    errors: [],
  },
  missingDlp: {
    eventCount: 50,
    blockedEventCount: 0,
    errorEventCount: 0,
    dlpRuleCount: 0,
    connectorPolicyCount: 1,
    latestEventAt: null,
    eventWindowLabel: "7 days",
    eventSampled: false,
    eventSampleCount: 50,
    errors: [],
  },
  missingConnectors: {
    eventCount: 10,
    blockedEventCount: 0,
    errorEventCount: 0,
    dlpRuleCount: 2,
    connectorPolicyCount: 0,
    latestEventAt: null,
    eventWindowLabel: "7 days",
    eventSampled: false,
    eventSampleCount: 10,
    errors: [],
  },
};

describe("dashboard ↔ chat welcome message contract", () => {
  for (const [scenario, facts] of Object.entries(FLEET_SCENARIOS)) {
    it(`chat welcome message never duplicates dashboard text (${scenario})`, () => {
      const fallback = buildFallbackOverview(facts);
      const data: OverviewData = {
        headline: fallback.headline,
        summary: fallback.summary,
        postureCards: fallback.postureCards.map((c) => ({
          label: c.label,
          value: c.value,
          note: c.note,
          source: c.source,
          action: c.action,
          status: c.status,
          priority: c.priority,
        })),
        suggestions: fallback.suggestions,
        sources: fallback.sources,
      };

      const welcomeMsg = generateWelcomeMessage(data);

      // The welcome message must never BE the headline or summary
      expect(welcomeMsg).not.toBe(data.headline);
      expect(welcomeMsg).not.toBe(data.summary);

      // The welcome message must never CONTAIN the headline or summary
      // (skip trivially short strings that would create false positives)
      if (data.headline.length > 10) {
        expect(welcomeMsg).not.toContain(data.headline);
      }
      if (data.summary.length > 10) {
        expect(welcomeMsg).not.toContain(data.summary);
      }
    });
  }

  it("chat welcome message never duplicates AI-generated headline", () => {
    const aiGenerated: OverviewData = {
      headline: "Quick fleet highlights are ready for your review.",
      summary:
        "Your fleet has 50 DLP rules and no critical events. I can guide you through setting up data protection rules and connector policies.",
      postureCards: [
        {
          label: "Data Protection Rules",
          value: "50 rules",
          note: "Protecting sensitive data",
          source: "Cloud Identity",
          action: "List DLP rules",
          status: "healthy",
          priority: 3,
        },
        {
          label: "Security Events",
          value: "0 events",
          note: "No events captured",
          source: "Admin SDK",
          action: "Show events",
          status: "warning",
          priority: 2,
        },
      ],
      suggestions: [],
      sources: ["Admin SDK Reports", "Cloud Identity"],
    };

    const welcomeMsg = generateWelcomeMessage(aiGenerated);

    expect(welcomeMsg).not.toBe(aiGenerated.headline);
    expect(welcomeMsg).not.toBe(aiGenerated.summary);
    expect(welcomeMsg).not.toContain(aiGenerated.headline);
    expect(welcomeMsg).not.toContain(aiGenerated.summary);
  });

  it("chat welcome message is always a meaningful introduction", () => {
    const data: OverviewData = {
      headline: "Fleet posture",
      summary: "",
      postureCards: [],
      suggestions: [],
      sources: [],
    };

    const withData = generateWelcomeMessage(data);
    const withNull = generateWelcomeMessage(null);

    // Both paths must identify the assistant
    expect(withData).toContain("Chrome Enterprise Premium assistant");
    expect(withNull).toContain("Chrome Enterprise Premium assistant");

    // Both must include a call to action
    expect(withData).toMatch(/suggestion|ask me anything/i);
    expect(withNull).toMatch(/suggestion|ask me anything/i);
  });
});

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

  it("has cursor-pointer on posture card buttons", async () => {
    mockSWRReturn = {
      data: {
        headline: "Status",
        summary: "Check posture.",
        postureCards: [
          {
            label: "Threat Events",
            value: "3",
            note: "Needs review",
            source: "api",
            action: "Show events",
            status: "warning",
            priority: 1,
          },
        ],
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
      const card = getByText("Threat Events").closest("button");
      expect(card).toHaveClass("cursor-pointer");
    });
  });

  it("has cursor-pointer on suggestion buttons", async () => {
    mockSWRReturn = {
      data: {
        headline: "Status",
        summary: "Recommendations available.",
        postureCards: [],
        suggestions: [
          {
            text: "Enable DLP",
            action: "Set up DLP",
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
      const suggestion = getByText("Enable DLP").closest("button");
      expect(suggestion).toHaveClass("cursor-pointer");
    });
  });

  it("has cursor-pointer on refresh button", async () => {
    mockSWRReturn = {
      data: {
        headline: "Fleet Status",
        summary: "OK",
        postureCards: [],
        suggestions: [],
        sources: [],
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    };

    const { getByLabelText } = render(
      <DashboardOverview onAction={mockOnAction} />
    );

    await waitFor(() => {
      const refreshBtn = getByLabelText("Refresh dashboard");
      expect(refreshBtn).toHaveClass("cursor-pointer");
    });
  });
});
