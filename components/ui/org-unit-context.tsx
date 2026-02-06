/**
 * React context for org unit display name resolution across the app.
 * Provides a centralized map from org unit IDs to their friendly names and paths,
 * enabling consistent rendering of org units in all components.
 */

"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Display info for a resolved org unit, containing both the leaf name and full path.
 */
export interface OrgUnitInfo {
  name: string;
  path: string;
}

/**
 * Context holding the org unit resolution map. Defaults to an empty map
 * so components degrade gracefully when no provider is present.
 */
const OrgUnitMapContext = createContext<Map<string, OrgUnitInfo>>(new Map());

/**
 * Provides org unit resolution data to descendant components.
 * The map should be keyed by normalized org unit identifiers (bare ID,
 * "orgunits/ID", "id:ID") for flexible lookups.
 */
export function OrgUnitMapProvider({
  map,
  children,
}: {
  map: Map<string, OrgUnitInfo>;
  children: ReactNode;
}) {
  return (
    <OrgUnitMapContext.Provider value={map}>
      {children}
    </OrgUnitMapContext.Provider>
  );
}

/**
 * Accesses the org unit resolution map from context. Returns an empty map
 * when called outside of an OrgUnitMapProvider.
 */
export function useOrgUnitMap() {
  return useContext(OrgUnitMapContext);
}
