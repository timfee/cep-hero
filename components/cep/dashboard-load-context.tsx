/**
 * Context for tracking dashboard loading state across components.
 * Used to coordinate animations and loading states between panels.
 */

"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Dashboard load context value.
 */
interface DashboardLoadContextValue {
  isDashboardLoaded: boolean;
  setDashboardLoaded: (loaded: boolean) => void;
}

const DashboardLoadContext = createContext<DashboardLoadContextValue>({
  isDashboardLoaded: false,
  setDashboardLoaded: () => {},
});

/**
 * Hook to access dashboard load state.
 */
export function useDashboardLoad() {
  return useContext(DashboardLoadContext);
}

/**
 * Props for the DashboardLoadProvider component.
 */
interface DashboardLoadProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that manages dashboard loading state.
 * Wrap the app shell content to enable loading coordination.
 */
export function DashboardLoadProvider({
  children,
}: DashboardLoadProviderProps) {
  const [isDashboardLoaded, setIsDashboardLoaded] = useState(false);

  const setDashboardLoaded = useCallback((loaded: boolean) => {
    setIsDashboardLoaded(loaded);
  }, []);

  return (
    <DashboardLoadContext.Provider
      value={{ isDashboardLoaded, setDashboardLoaded }}
    >
      {children}
    </DashboardLoadContext.Provider>
  );
}
