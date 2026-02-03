"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ActiveFixture, useFixtureContext } from "@/lib/fixtures/context";

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
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="animate-spin" />
        Loading scenarios...
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
      >
        <FlaskConical className="size-3" />
        <span className="text-destructive">Error loading</span>
      </Button>
    );
  }

  return (
    <Select
      value={activeFixture?.id ?? ""}
      onValueChange={(value) => void handleSelectFixture(value)}
    >
      <SelectTrigger size="sm" className="w-[200px]">
        {loadingFixture ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" />
            Loading...
          </span>
        ) : (
          <>
            <FlaskConical className="size-3" />
            <SelectValue placeholder="Demo scenarios" />
          </>
        )}
      </SelectTrigger>
      <SelectContent>
        {activeFixture && (
          <SelectGroup>
            <SelectItem value="__clear__">
              <span className="text-muted-foreground">Clear demo mode</span>
            </SelectItem>
          </SelectGroup>
        )}
        {categories.map((category) => (
          <SelectGroup key={category}>
            <SelectLabel className="capitalize">{category}</SelectLabel>
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
