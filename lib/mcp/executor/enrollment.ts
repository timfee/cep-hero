import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { z } from "zod";

import { createApiError, getErrorDetails } from "@/lib/mcp/errors";
import { type EnrollBrowserSchema } from "@/lib/mcp/schemas";

import { buildOrgUnitTargetResource } from "./utils";

export type EnrollBrowserArgs = z.infer<typeof EnrollBrowserSchema>;

/** Validates the nested structure of the Chrome Management API client. */
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

interface EnrollBrowserError {
  error: string;
  suggestion: string;
  requiresReauth: boolean;
}

export type EnrollBrowserResult = EnrollBrowserSuccess | EnrollBrowserError;

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

const DEFAULT_TARGET = "customers/my_customer";
const POLICY_SCHEMA_ID = "chrome.users.EnrollmentToken";

const SERVICE_UNAVAILABLE: EnrollBrowserError = {
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
): Promise<EnrollBrowserResult> {
  const service = googleApis.chromemanagement({ version: "v1", auth });
  const createFn = getEnrollmentCreateFn(service.customers);

  if (createFn === null) {
    return SERVICE_UNAVAILABLE;
  }

  const targetResource = resolveTargetResource(args.orgUnitId);
  console.log("[enroll-browser] request", {
    orgUnitId: args.orgUnitId,
    targetResource,
  });

  const result = await executeEnrollment(createFn, customerId, targetResource);
  return result;
}

function getEnrollmentCreateFn(customers: unknown): EnrollmentCreateFn | null {
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

function hasEnrollmentCreate(value: unknown): value is EnrollmentCapable {
  const result = EnrollmentClientSchema.safeParse(value);
  if (!result.success) {
    return false;
  }
  return typeof result.data.policies.networks.enrollments.create === "function";
}

async function executeEnrollment(
  createFn: EnrollmentCreateFn,
  customerId: string,
  targetResource: string
): Promise<EnrollBrowserResult> {
  try {
    const res = await createFn({
      parent: `customers/${customerId}`,
      requestBody: {
        policySchemaId: POLICY_SCHEMA_ID,
        policyTargetKey: { targetResource },
      },
    });

    console.log(
      "[enroll-browser] response",
      JSON.stringify({
        token: res.data.name ?? "",
        expires: res.data.expirationTime,
      })
    );

    return {
      enrollmentToken: res.data.name ?? "",
      expiresAt: res.data.expirationTime ?? null,
    };
  } catch (error: unknown) {
    logEnrollmentError(error);
    return createApiError(error, "enroll-browser");
  }
}

function logEnrollmentError(error: unknown): void {
  const { code, message, errors } = getErrorDetails(error);
  console.log(
    "[enroll-browser] error",
    JSON.stringify({ code, message, errors })
  );
}

function resolveTargetResource(orgUnitId: string | undefined): string {
  if (orgUnitId === undefined) {
    return DEFAULT_TARGET;
  }
  const normalized = buildOrgUnitTargetResource(orgUnitId);
  if (normalized.length === 0) {
    return DEFAULT_TARGET;
  }
  return normalized;
}
