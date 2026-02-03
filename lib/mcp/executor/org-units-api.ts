import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";

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

/**
 * List all organizational units for the customer.
 */
export async function listOrgUnits(
  auth: OAuth2Client,
  customerId: string
): Promise<ListOrgUnitsResult> {
  const service = googleApis.admin({
    version: "directory_v1",
    auth,
  });

  console.log("[org-units] request");

  try {
    if (service.orgunits?.list === undefined) {
      return {
        error: "Directory orgunit client unavailable",
        suggestion: "Confirm Admin SDK is enabled and has correct scopes.",
        requiresReauth: false,
      };
    }

    const res = await service.orgunits.list({
      customerId,
      type: "all",
    });

    console.log(
      "[org-units] response",
      JSON.stringify({
        count: res.data.organizationUnits?.length ?? 0,
      })
    );

    const units = (res.data.organizationUnits ?? []).map((ou) => ({
      orgUnitId: ou.orgUnitId,
      name: ou.name,
      orgUnitPath: ou.orgUnitPath,
      parentOrgUnitId: ou.parentOrgUnitId,
      description: ou.description,
    }));

    return { orgUnits: units };
  } catch (error: unknown) {
    const { code, message, errors } = getErrorDetails(error);
    console.log("[org-units] error", JSON.stringify({ code, message, errors }));
    return createApiError(error, "org-units");
  }
}
