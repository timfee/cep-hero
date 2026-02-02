import type {
  admin_directory_v1,
  chromepolicy_v1,
  chromemanagement_v1,
} from "googleapis";

import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

import { getServiceAccountAccessToken } from "@/lib/google-service-account";

type Directory = admin_directory_v1.Admin;
type ChromePolicy = chromepolicy_v1.Chromepolicy;
type ChromeManagement = chromemanagement_v1.Chromemanagement;

export type GoogleClients = {
  directory: Directory;
  policy: ChromePolicy;
  management: ChromeManagement;
  tokenEmail?: string;
  customerId: string;
};

async function resolveCustomerIdFromPolicySchemas(
  policy: ChromePolicy
): Promise<string | null> {
  try {
    const res = await policy.customers.policySchemas.list({
      parent: "customers/my_customer",
      pageSize: 1,
    });
    const name = res.data.policySchemas?.[0]?.name ?? "";
    const match = name.match(/customers\/([^/]+)\//);
    return match?.[1] ?? null;
  } catch (error) {
    console.warn("[google-admin] resolve customer id", {
      message: getErrorMessage(error),
    });
    return null;
  }
}

export async function makeGoogleClients(): Promise<GoogleClients> {
  const envCustomerId = process.env.GOOGLE_CUSTOMER_ID;
  let customerId = envCustomerId ?? "my_customer";
  const tokenEmail = process.env.GOOGLE_TOKEN_EMAIL;
  const accessToken = await getServiceAccountAccessToken(
    [
      "https://www.googleapis.com/auth/admin.directory.user",
      "https://www.googleapis.com/auth/admin.directory.orgunit",
      "https://www.googleapis.com/auth/admin.directory.group",
      "https://www.googleapis.com/auth/admin.reports.audit.readonly",
      "https://www.googleapis.com/auth/chrome.management.policy",
      "https://www.googleapis.com/auth/chrome.management.policy.readonly",
    ],
    tokenEmail
  );

  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });

  const directory = google.admin({ version: "directory_v1", auth });
  const policy = google.chromepolicy({ version: "v1", auth });
  const management = google.chromemanagement({ version: "v1", auth });

  if (!envCustomerId) {
    const resolvedCustomerId = await resolveCustomerIdFromPolicySchemas(policy);
    if (resolvedCustomerId) {
      customerId = resolvedCustomerId;
    }
  }

  return { directory, policy, management, tokenEmail, customerId };
}

export async function listDomains() {
  const { directory, customerId } = await makeGoogleClients();
  const res = await directory.domains.list({ customer: customerId });
  return res.data.domains ?? [];
}

export async function detectPrimaryDomain() {
  const domains = await listDomains();
  const primary = domains.find((domain) => domain.isPrimary) ?? domains[0];
  return primary?.domainName ?? null;
}

/**
 * Normalize error values to a message string.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const message =
    error && typeof error === "object"
      ? Reflect.get(error, "message")
      : undefined;

  return typeof message === "string" ? message : "Unknown error";
}

export async function listUsers({
  maxResults = 25,
}: { maxResults?: number } = {}) {
  const { directory, customerId } = await makeGoogleClients();
  const res = await directory.users.list({ customer: customerId, maxResults });
  return res.data.users ?? [];
}

export async function detectDomainFromUsers() {
  const users = await listUsers({ maxResults: 50 });
  const domains = users
    .map((user) => user.primaryEmail?.split("@")[1])
    .filter((domain): domain is string => Boolean(domain));
  return domains[0] ?? null;
}

export async function getRootOrgUnit() {
  const { directory, customerId } = await makeGoogleClients();
  const res = await directory.orgunits.list({
    customerId,
    orgUnitPath: "/",
    type: "children",
  });
  const list = res.data.organizationUnits ?? [];
  return list[0] ?? null;
}

export async function listOrgUnits() {
  const { directory, customerId } = await makeGoogleClients();
  const res = await directory.orgunits.list({
    customerId,
    type: "all",
  });
  const root = await getRootOrgUnit();
  const list = res.data.organizationUnits ?? [];
  if (
    root?.orgUnitPath &&
    !list.some((ou) => ou.orgUnitPath === root.orgUnitPath)
  ) {
    return [root, ...list];
  }
  return list;
}

export async function listPolicySchemas({
  filter,
  pageSize = 200,
}: {
  filter?: string;
  pageSize?: number;
}) {
  const { policy, customerId } = await makeGoogleClients();
  const params = filter ? { filter } : {};
  const res = await policy.customers.policySchemas.list({
    parent: `customers/${customerId}`,
    pageSize,
    ...params,
  });
  return res.data.policySchemas ?? [];
}

export async function probePolicyTargetResources({
  policySchemaFilter,
  targetResources,
  pageSize = 100,
}: {
  policySchemaFilter: string;
  targetResources: string[];
  pageSize?: number;
}) {
  const { policy, customerId } = await makeGoogleClients();
  const results: Array<{
    targetResource: string;
    resolvedPolicies: chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[];
  }> = [];
  const errors: Array<{ targetResource: string; message: string }> = [];

  const uniqueTargets = Array.from(new Set(targetResources));

  for (const targetResource of uniqueTargets) {
    // The resolve endpoint only supports 'orgunits' or 'groups'.
    // It does not support 'customers' (use root org unit instead).
    if (targetResource.startsWith("customers/")) {
      continue;
    }

    try {
      const res = await policy.customers.policies.resolve({
        customer: `customers/${customerId}`,
        requestBody: {
          policySchemaFilter,
          policyTargetKey: { targetResource },
          pageSize,
        },
      });
      results.push({
        targetResource,
        resolvedPolicies: res.data.resolvedPolicies ?? [],
      });
    } catch (error) {
      const message = getErrorMessage(error);
      const isIgnorable =
        message.includes("Requested entity was not found") ||
        message.includes("must be of type 'orgunits' or 'groups'");

      if (!isIgnorable) {
        errors.push({
          targetResource,
          message,
        });
      }
    }
  }

  return { results, errors };
}

export async function createOrgUnit({
  name,
  parentOrgUnitPath = "/",
}: {
  name: string;
  parentOrgUnitPath?: string;
}) {
  const { directory, customerId } = await makeGoogleClients();
  const res = await directory.orgunits.insert({
    customerId,
    requestBody: {
      name,
      orgUnitPath: undefined,
      parentOrgUnitPath,
    },
  });
  const orgUnitPath = res.data.orgUnitPath ?? `/`;
  const orgUnitId = (res.data.orgUnitId ?? "").replace(/^id:/, "");
  return {
    orgUnitPath,
    orgUnitId,
  };
}

export async function deleteOrgUnit(orgUnitPath: string) {
  const { directory, customerId } = await makeGoogleClients();
  await directory.orgunits.delete({
    customerId,
    orgUnitPath,
  });
}

export async function createUser({
  primaryEmail,
  password,
  orgUnitPath,
}: {
  primaryEmail: string;
  password: string;
  orgUnitPath?: string;
}) {
  const { directory, tokenEmail } = await makeGoogleClients();
  const res = await directory.users.insert({
    requestBody: {
      primaryEmail,
      password,
      orgUnitPath,
      changePasswordAtNextLogin: false,
      name: {
        familyName: "Test",
        givenName: primaryEmail.split("@")[0],
      },
      recoveryEmail: tokenEmail,
    },
  });
  return res.data.id;
}

export async function deleteUser(primaryEmail: string) {
  const { directory } = await makeGoogleClients();
  await directory.users.delete({ userKey: primaryEmail });
}

export async function createGroup({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const { directory } = await makeGoogleClients();
  const res = await directory.groups.insert({
    requestBody: {
      email,
      name,
    },
  });
  return res.data.id;
}

export async function deleteGroup(groupKey: string) {
  const { directory } = await makeGoogleClients();
  await directory.groups.delete({ groupKey });
}

export async function addUserToGroup({
  groupKey,
  email,
  role = "MEMBER",
}: {
  groupKey: string;
  email: string;
  role?: "OWNER" | "MANAGER" | "MEMBER";
}) {
  const { directory } = await makeGoogleClients();
  await directory.members.insert({
    groupKey,
    requestBody: {
      email,
      role,
    },
  });
}

export async function removeUserFromGroup({
  groupKey,
  email,
}: {
  groupKey: string;
  email: string;
}) {
  const { directory } = await makeGoogleClients();
  await directory.members.delete({ groupKey, memberKey: email });
}

export async function resolvePolicies({
  policySchemaFilter,
  targetResource,
  pageSize = 100,
}: {
  policySchemaFilter: string;
  targetResource: string;
  pageSize?: number;
}) {
  const { policy, customerId } = await makeGoogleClients();
  const res = await policy.customers.policies.resolve({
    customer: `customers/${customerId}`,
    requestBody: {
      policySchemaFilter,
      policyTargetKey: { targetResource },
      pageSize,
    },
  });
  return res.data.resolvedPolicies ?? [];
}

function buildUpdateMask(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.length > 0 ? keys.join(",") : "";
}

export async function applyOrgUnitPolicy({
  policySchemaId,
  targetResource,
  value,
}: {
  policySchemaId: string;
  targetResource: string;
  value: Record<string, unknown>;
}) {
  const { policy, customerId } = await makeGoogleClients();
  const updateMask = buildUpdateMask(value);
  await policy.customers.policies.orgunits.batchModify({
    customer: `customers/${customerId}`,
    requestBody: {
      requests: [
        {
          policyTargetKey: { targetResource },
          policyValue: {
            policySchema: policySchemaId,
            value,
          },
          updateMask,
        },
      ],
    },
  });
}

export async function inheritOrgUnitPolicy({
  policySchemaId,
  targetResource,
}: {
  policySchemaId: string;
  targetResource: string;
}) {
  const { policy, customerId } = await makeGoogleClients();
  await policy.customers.policies.orgunits.batchInherit({
    customer: `customers/${customerId}`,
    requestBody: {
      requests: [
        {
          policyTargetKey: { targetResource },
          policySchema: policySchemaId,
        },
      ],
    },
  });
}

export async function applyGroupPolicy({
  policySchemaId,
  targetResource,
  value,
}: {
  policySchemaId: string;
  targetResource: string;
  value: Record<string, unknown>;
}) {
  const { policy, customerId } = await makeGoogleClients();
  const updateMask = buildUpdateMask(value);
  await policy.customers.policies.groups.batchModify({
    customer: `customers/${customerId}`,
    requestBody: {
      requests: [
        {
          policyTargetKey: { targetResource },
          policyValue: {
            policySchema: policySchemaId,
            value,
          },
          updateMask,
        },
      ],
    },
  });
}

export async function deleteGroupPolicy({
  policySchemaId,
  targetResource,
}: {
  policySchemaId: string;
  targetResource: string;
}) {
  const { policy, customerId } = await makeGoogleClients();
  await policy.customers.policies.groups.batchDelete({
    customer: `customers/${customerId}`,
    requestBody: {
      requests: [
        {
          policyTargetKey: { targetResource },
          policySchema: policySchemaId,
        },
      ],
    },
  });
}

export async function createEnrollmentToken(targetResource: string) {
  const { management, customerId } = await makeGoogleClients();
  const createEnrollment = getEnrollmentCreate(management);

  if (!createEnrollment) {
    throw new Error("Enrollment client unavailable");
  }

  const res = await createEnrollment({
    parent: `customers/${customerId}`,
    requestBody: {
      policySchemaId: "chrome.users.EnrollmentToken",
      policyTargetKey: { targetResource },
    },
  });
  return {
    token: res.data.name ?? "",
    expiresAt: res.data.expirationTime ?? null,
  };
}

/**
 * Resolve the Chrome Management enrollment creation handler.
 */
function getEnrollmentCreate(service: unknown):
  | ((args: {
      parent: string;
      requestBody: {
        policySchemaId: string;
        policyTargetKey: { targetResource: string };
      };
    }) => Promise<{
      data: { name?: string | null; expirationTime?: string | null };
    }>)
  | null {
  if (!service || typeof service !== "object") {
    return null;
  }

  const customers = Reflect.get(service, "customers");
  if (!customers || typeof customers !== "object") {
    return null;
  }

  const policies = Reflect.get(customers, "policies");
  if (!policies || typeof policies !== "object") {
    return null;
  }

  const networks = Reflect.get(policies, "networks");
  if (!networks || typeof networks !== "object") {
    return null;
  }

  const enrollments = Reflect.get(networks, "enrollments");
  if (!enrollments || typeof enrollments !== "object") {
    return null;
  }

  const create = Reflect.get(enrollments, "create");
  return typeof create === "function" ? create.bind(enrollments) : null;
}
