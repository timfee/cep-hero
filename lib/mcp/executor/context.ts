/**
 * Organizational unit context fetching for policy resolution and display.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis, type admin_directory_v1 } from "googleapis";

import { getErrorMessage } from "@/lib/mcp/errors";
import {
  buildOrgUnitNameMap,
  normalizeResource,
  type OrgUnit,
} from "@/lib/mcp/org-units";

type DirectoryService = admin_directory_v1.Admin;

export interface OrgUnitContext {
  orgUnitList: OrgUnit[];
  orgUnitNameMap: Map<string, string>;
  rootOrgUnitId: string | null;
  rootOrgUnitPath: string | null;
  error?: string;
}

/**
 * Fetch org unit context including list and root OU.
 */
export async function fetchOrgUnitContext(
  auth: OAuth2Client,
  customerId: string
) {
  const directory = googleApis.admin({
    version: "directory_v1",
    auth,
  });

  const orgUnitList = await fetchOrgUnitList(directory, customerId);
  const { rootOrgUnitId, rootOrgUnitPath, error } = await fetchRootOrgUnit(
    directory,
    customerId
  );
  const orgUnitNameMap = buildOrgUnitNameMap(orgUnitList);

  if (rootOrgUnitId !== null && rootOrgUnitPath !== null) {
    addRootToNameMap(orgUnitNameMap, rootOrgUnitId, rootOrgUnitPath);
  }

  return {
    orgUnitList,
    orgUnitNameMap,
    rootOrgUnitId,
    rootOrgUnitPath,
    error,
  };
}

/**
 * Lists all org units for the customer.
 */
async function fetchOrgUnitList(
  directory: DirectoryService,
  customerId: string
) {
  try {
    if (directory.orgunits?.list === undefined) {
      return [];
    }
    const orgUnits = await directory.orgunits.list({
      customerId,
      type: "all",
    });
    return orgUnits?.data.organizationUnits ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetches the root org unit details.
 */
async function fetchRootOrgUnit(
  directory: DirectoryService,
  customerId: string
) {
  try {
    if (directory.orgunits?.get === undefined) {
      return { rootOrgUnitId: null, rootOrgUnitPath: null };
    }
    const rootRes = await directory.orgunits.get({
      customerId,
      orgUnitPath: "/",
    });
    return {
      rootOrgUnitId: rootRes.data.orgUnitId ?? null,
      rootOrgUnitPath: rootRes.data.orgUnitPath ?? rootRes.data.name ?? "/",
    };
  } catch (fetchError) {
    return {
      rootOrgUnitId: null,
      rootOrgUnitPath: null,
      error: getErrorMessage(fetchError),
    };
  }
}

/**
 * Registers the root org unit in the lookup map.
 */
function addRootToNameMap(
  nameMap: Map<string, string>,
  rootOrgUnitId: string,
  rootOrgUnitPath: string
) {
  const normalizedRoot = normalizeResource(rootOrgUnitId);
  nameMap.set(normalizedRoot, rootOrgUnitPath);
  nameMap.set(`orgunits/${normalizedRoot}`, rootOrgUnitPath);
}
