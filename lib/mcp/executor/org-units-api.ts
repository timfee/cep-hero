/**
 * Admin SDK Directory API wrapper for listing organizational units.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis, type admin_directory_v1 } from "googleapis";

import {
  type ApiErrorResponse,
  createApiError,
  logApiError,
  logApiRequest,
  logApiResponse,
} from "@/lib/mcp/errors";

interface OrgUnitItem {
  orgUnitId?: string | null;
  name?: string | null;
  orgUnitPath?: string | null;
  parentOrgUnitId?: string | null;
  description?: string | null;
}

interface ListOrgUnitsSuccess {
  orgUnits: OrgUnitItem[];
}

/**
 * Result of listing organizational units, either a list of units or an error.
 */
export type ListOrgUnitsResult = ListOrgUnitsSuccess | ApiErrorResponse;

const SERVICE_UNAVAILABLE: ApiErrorResponse = {
  error: "Directory orgunit client unavailable",
  suggestion: "Confirm Admin SDK is enabled and has correct scopes.",
  requiresReauth: false,
};

/**
 * Fetches all organizational units for a Google Workspace customer. Returns
 * a flat list with IDs, names, paths, and parent relationships.
 */
export async function listOrgUnits(auth: OAuth2Client, customerId: string) {
  const service = googleApis.admin({ version: "directory_v1", auth });
  logApiRequest("org-units");

  if (service.orgunits?.list === undefined) {
    return SERVICE_UNAVAILABLE;
  }

  try {
    const res = await service.orgunits.list({ customerId, type: "all" });
    logApiResponse("org-units", {
      count: res.data.organizationUnits?.length ?? 0,
    });
    return { orgUnits: mapOrgUnits(res.data.organizationUnits ?? []) };
  } catch (error: unknown) {
    logApiError("org-units", error);
    return createApiError(error, "org-units");
  }
}

/**
 * Maps API response to a simplified org unit structure.
 */
function mapOrgUnits(units: admin_directory_v1.Schema$OrgUnit[]) {
  return units.map((ou) => ({
    orgUnitId: ou.orgUnitId,
    name: ou.name,
    orgUnitPath: ou.orgUnitPath,
    parentOrgUnitId: ou.parentOrgUnitId,
    description: ou.description,
  }));
}
