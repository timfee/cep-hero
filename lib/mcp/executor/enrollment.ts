/**
 * Chrome Browser Cloud Management enrollment token generation.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { z } from "zod";

import {
  DEFAULT_CUSTOMER_TARGET,
  ENROLLMENT_TOKEN_POLICY_SCHEMA,
} from "@/lib/mcp/constants";
import {
  type ApiErrorResponse,
  createApiError,
  logApiError,
  logApiRequest,
  logApiResponse,
} from "@/lib/mcp/errors";
import { buildOrgUnitTargetResource } from "@/lib/mcp/org-units";
import { type EnrollBrowserSchema } from "@/lib/mcp/schemas";

/**
 * Arguments for generating a Chrome Browser Cloud Management enrollment token.
 */
export type EnrollBrowserArgs = z.infer<typeof EnrollBrowserSchema>;

/**
 * Validates the nested structure of the Chrome Management API client.
 */
const EnrollmentClientSchema = z.object({
  policies: z.object({
    networks: z.object({
      enrollments: z.object({
        create: z.unknown(),
      }),
    }),
  }),
});

interface EnrollBrowserSuccess {
  enrollmentToken: string;
  expiresAt: string | null;
}

/**
 * Result of generating an enrollment token, either a token or an error.
 */
export type EnrollBrowserResult = EnrollBrowserSuccess | ApiErrorResponse;

interface EnrollmentResponse {
  data: { name?: string | null; expirationTime?: string | null };
}

type EnrollmentCreateFn = (args: {
  parent: string;
  requestBody: {
    policySchemaId: string;
    policyTargetKey: { targetResource: string };
  };
}) => Promise<EnrollmentResponse>;

const SERVICE_UNAVAILABLE: ApiErrorResponse = {
  error: "Chrome Management enrollment client unavailable",
  suggestion:
    "Confirm Chrome Management API is enabled and the account has enrollment permissions.",
  requiresReauth: false,
};

/**
 * Generates a Chrome Browser Cloud Management enrollment token. Tokens allow
 * browsers to self-register with the organization's management policies.
 */
export async function enrollBrowser(
  auth: OAuth2Client,
  customerId: string,
  args: EnrollBrowserArgs
) {
  const service = googleApis.chromemanagement({ version: "v1", auth });
  const createFn = getEnrollmentCreateFn(service.customers);

  if (createFn === null) {
    return SERVICE_UNAVAILABLE;
  }

  const targetResource = resolveTargetResource(args.orgUnitId);
  logApiRequest("enroll-browser", {
    orgUnitId: args.orgUnitId,
    targetResource,
  });

  const result = await executeEnrollment(createFn, customerId, targetResource);
  return result;
}

/**
 * Extracts the enrollment create function from the API client.
 */
function getEnrollmentCreateFn(customers: unknown) {
  if (!hasEnrollmentCreate(customers)) {
    return null;
  }
  return customers.policies.networks.enrollments.create;
}

interface EnrollmentCapable {
  policies: {
    networks: {
      enrollments: {
        create: EnrollmentCreateFn;
      };
    };
  };
}

/**
 * Type guard for checking enrollment API availability.
 */
function hasEnrollmentCreate(value: unknown): value is EnrollmentCapable {
  const result = EnrollmentClientSchema.safeParse(value);
  if (!result.success) {
    return false;
  }
  return typeof result.data.policies.networks.enrollments.create === "function";
}

/**
 * Executes the enrollment API call and handles the response.
 */
async function executeEnrollment(
  createFn: EnrollmentCreateFn,
  customerId: string,
  targetResource: string
) {
  try {
    const res = await createFn({
      parent: `customers/${customerId}`,
      requestBody: {
        policySchemaId: ENROLLMENT_TOKEN_POLICY_SCHEMA,
        policyTargetKey: { targetResource },
      },
    });

    logApiResponse("enroll-browser", {
      token: res.data.name ?? "",
      expires: res.data.expirationTime,
    });

    return {
      enrollmentToken: res.data.name ?? "",
      expiresAt: res.data.expirationTime ?? null,
    };
  } catch (error: unknown) {
    logApiError("enroll-browser", error);
    return createApiError(error, "enroll-browser");
  }
}

/**
 * Determines the target resource for enrollment, defaulting to customer.
 */
function resolveTargetResource(orgUnitId: string | undefined) {
  if (orgUnitId === undefined) {
    return DEFAULT_CUSTOMER_TARGET;
  }
  const normalized = buildOrgUnitTargetResource(orgUnitId);
  if (normalized.length === 0) {
    return DEFAULT_CUSTOMER_TARGET;
  }
  return normalized;
}
