"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { type FixtureData } from "@/lib/mcp/types";

export interface ActiveFixture {
  id: string;
  title: string;
  category: string;
  data: FixtureData;
}

interface FixtureContextValue {
  activeFixture: ActiveFixture | null;
  setActiveFixture: (fixture: ActiveFixture | null) => void;
  clearFixture: () => void;
  isFixtureMode: boolean;
}

const FixtureContext = createContext<FixtureContextValue | null>(null);

export function FixtureProvider({ children }: { children: React.ReactNode }) {
  const [activeFixture, setActiveFixtureState] = useState<ActiveFixture | null>(
    null
  );

  const setActiveFixture = useCallback((fixture: ActiveFixture | null) => {
    setActiveFixtureState(fixture);
  }, []);

  const clearFixture = useCallback(() => {
    setActiveFixtureState(null);
  }, []);

  const value = useMemo<FixtureContextValue>(
    () => ({
      activeFixture,
      setActiveFixture,
      clearFixture,
      isFixtureMode: activeFixture !== null,
    }),
    [activeFixture, setActiveFixture, clearFixture]
  );

  return (
    <FixtureContext.Provider value={value}>{children}</FixtureContext.Provider>
  );
}

export function useFixtureContext(): FixtureContextValue {
  const ctx = useContext(FixtureContext);
  if (!ctx) {
    throw new Error("useFixtureContext must be used within a FixtureProvider");
  }
  return ctx;
}
