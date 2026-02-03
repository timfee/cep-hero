import { type OAuth2Client } from "google-auth-library";
import { google as googleApis } from "googleapis";
import { type z } from "zod";

import { createApiError, getErrorDetails } from "@/lib/mcp/errors";
import { type EnrollBrowserSchema } from "@/lib/mcp/schemas";

import { buildOrgUnitTargetResource } from "./utils";

export type EnrollBrowserArgs = z.infer<typeof EnrollBrowserSchema>;

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

type EnrollmentCreate = (args: {
  parent: string;
  requestBody: {
    policySchemaId: string;
    policyTargetKey: { targetResource: string };
  };
}) => Promise<{
  data: { name?: string | null; expirationTime?: string | null };
}>;

interface CustomersApi {
  policies?: {
    networks?: {
      enrollments?: {
        create?: EnrollmentCreate;
      };
    };
  };
}

/**
 * Generate a new enrollment token for Chrome Browser Cloud Management.
 */
export async function enrollBrowser(
  auth: OAuth2Client,
  customerId: string,
  args: EnrollBrowserArgs
): Promise<EnrollBrowserResult> {
  const service = googleApis.chromemanagement({
    version: "v1",
    auth,
  });

  const customers = service.customers as unknown as CustomersApi;
  const targetResource = buildTargetResource(args.orgUnitId);

  console.log("[enroll-browser] request", {
    orgUnitId: args.orgUnitId,
    targetResource,
  });

  try {
    if (customers.policies?.networks?.enrollments?.create === undefined) {
      return {
        error: "Chrome Management enrollment client unavailable",
        suggestion:
          "Confirm Chrome Management API is enabled and the account has enrollment permissions.",
        requiresReauth: false,
      };
    }

    const res = await customers.policies.networks.enrollments.create({
      parent: `customers/${customerId}`,
      requestBody: {
        policySchemaId: "chrome.users.EnrollmentToken",
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
    const { code, message, errors } = getErrorDetails(error);
    console.log(
      "[enroll-browser] error",
      JSON.stringify({ code, message, errors })
    );
    return createApiError(error, "enroll-browser");
  }
}

function buildTargetResource(orgUnitId: string | undefined): string {
  if (orgUnitId === undefined) {
    return "customers/my_customer";
  }
  const normalized = buildOrgUnitTargetResource(orgUnitId);
  return normalized !== "" ? normalized : "customers/my_customer";
}
