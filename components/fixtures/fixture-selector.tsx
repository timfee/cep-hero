"use client";

import { FlaskConical, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ActiveFixture, useFixtureContext } from "@/lib/fixtures/context";
import { cn } from "@/lib/utils";

interface FixtureListItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
}

interface FixturesResponse {
  fixtures: FixtureListItem[];
  categories: string[];
  total: number;
}

interface FixtureDetailResponse {
  id: string;
  title: string;
  category: string;
  data: ActiveFixture["data"];
}

/** Color variants for category badges */
const CATEGORY_COLORS: Record<string, string> = {
  enrollment: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  policy: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  updates: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  security: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  compliance: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  default: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

/**
 * Dropdown selector for choosing a fixture scenario to override live data.
 * Fetches available fixtures from the API and loads fixture data when selected.
 */
export function FixtureSelector() {
  const { activeFixture, setActiveFixture, clearFixture } = useFixtureContext();
  const [fixtures, setFixtures] = useState<FixtureListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFixture, setLoadingFixture] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available fixtures on mount
  useEffect(() => {
    async function fetchFixtures() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/fixtures");
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ??
              `Failed to load fixtures: ${response.status}`
          );
        }
        const data: FixturesResponse = await response.json();
        setFixtures(data.fixtures);
        setCategories(data.categories);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[fixture-selector] Failed to fetch fixtures:", message);
      } finally {
        setLoading(false);
      }
    }
    void fetchFixtures();
  }, []);

  const handleSelectFixture = useCallback(
    async (fixtureId: string) => {
      if (fixtureId === "__clear__") {
        clearFixture();
        return;
      }

      setLoadingFixture(true);
      setError(null);
      try {
        const response = await fetch(`/api/fixtures/${fixtureId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ??
              `Failed to load fixture: ${response.status}`
          );
        }
        const data: FixtureDetailResponse = await response.json();
        setActiveFixture({
          id: data.id,
          title: data.title,
          category: data.category,
          data: data.data,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[fixture-selector] Failed to load fixture:", message);
      } finally {
        setLoadingFixture(false);
      }
    },
    [setActiveFixture, clearFixture]
  );

  // Group fixtures by category
  const fixturesByCategory = categories.reduce(
    (acc, category) => {
      acc[category] = fixtures.filter((f) => f.category === category);
      return acc;
    },
    {} as Record<string, FixtureListItem[]>
  );

  if (loading) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="border-dashed border-violet-500/40 bg-violet-500/5"
      >
        <Loader2 className="animate-spin text-violet-400" />
        <span className="text-violet-300">Loading...</span>
      </Button>
    );
  }

  if (error && fixtures.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
        title={error}
        className="border-dashed border-destructive/40"
      >
        <FlaskConical className="size-3 text-destructive" />
        <span className="text-destructive">Error loading</span>
      </Button>
    );
  }

  return (
    <Select
      value={activeFixture?.id ?? ""}
      onValueChange={(value) => void handleSelectFixture(value)}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          "w-[200px] border-dashed transition-colors",
          activeFixture
            ? "border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
            : "border-violet-500/40 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/60"
        )}
      >
        {loadingFixture ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-3 animate-spin text-violet-400" />
            <span className="text-violet-300">Loading...</span>
          </span>
        ) : (
          <>
            <FlaskConical
              className={cn(
                "size-3.5",
                activeFixture ? "text-amber-400" : "text-violet-400"
              )}
            />
            <SelectValue placeholder="Demo scenarios" />
          </>
        )}
      </SelectTrigger>
      <SelectContent className="min-w-[280px]">
        {activeFixture && (
          <>
            <SelectGroup>
              <SelectItem value="__clear__" className="text-muted-foreground">
                <X className="size-3 text-muted-foreground" />
                <span>Exit demo mode</span>
              </SelectItem>
            </SelectGroup>
            <SelectSeparator />
          </>
        )}
        {categories.map((category, index) => (
          <SelectGroup key={category}>
            {index > 0 && <SelectSeparator className="my-2" />}
            <SelectLabel className="flex items-center gap-2 py-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase tracking-wider border",
                  getCategoryColor(category)
                )}
              >
                {category}
              </Badge>
              <span className="text-muted-foreground/60 text-[10px]">
                {fixturesByCategory[category].length} scenario
                {fixturesByCategory[category].length !== 1 ? "s" : ""}
              </span>
            </SelectLabel>
            {fixturesByCategory[category].map((fixture) => (
              <SelectItem key={fixture.id} value={fixture.id}>
                <span className="truncate">{fixture.title}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
