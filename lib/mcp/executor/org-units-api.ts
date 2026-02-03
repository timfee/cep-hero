import { type OAuth2Client } from "google-auth-library";
import { google as googleApis, type admin_directory_v1 } from "googleapis";

import { createApiError, getErrorDetails } from "@/lib/mcp/errors";

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

interface ListOrgUnitsError {
  error: string;
  suggestion: string;
  requiresReauth: boolean;
}

export type ListOrgUnitsResult = ListOrgUnitsSuccess | ListOrgUnitsError;

const SERVICE_UNAVAILABLE: ListOrgUnitsError = {
  error: "Directory orgunit client unavailable",
  suggestion: "Confirm Admin SDK is enabled and has correct scopes.",
  requiresReauth: false,
};

/**
 * Fetches all organizational units for a Google Workspace customer. Returns
 * a flat list with IDs, names, paths, and parent relationships.
 */
export async function listOrgUnits(
  auth: OAuth2Client,
  customerId: string
): Promise<ListOrgUnitsResult> {
  const service = googleApis.admin({ version: "directory_v1", auth });
  console.log("[org-units] request");

  if (service.orgunits?.list === undefined) {
    return SERVICE_UNAVAILABLE;
  }

  try {
    const res = await service.orgunits.list({ customerId, type: "all" });
    console.log(
      "[org-units] response",
      JSON.stringify({
        count: res.data.organizationUnits?.length ?? 0,
      })
    );
    return { orgUnits: mapOrgUnits(res.data.organizationUnits ?? []) };
  } catch (error: unknown) {
    logError(error);
    return createApiError(error, "org-units");
  }
}

function mapOrgUnits(
  units: admin_directory_v1.Schema$OrgUnit[]
): OrgUnitItem[] {
  return units.map((ou) => ({
    orgUnitId: ou.orgUnitId,
    name: ou.name,
    orgUnitPath: ou.orgUnitPath,
    parentOrgUnitId: ou.parentOrgUnitId,
    description: ou.description,
  }));
}

function logError(error: unknown): void {
  const { code, message, errors } = getErrorDetails(error);
  console.log("[org-units] error", JSON.stringify({ code, message, errors }));
}
