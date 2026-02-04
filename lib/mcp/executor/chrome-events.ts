/**
 * Chrome audit event fetching from Admin SDK Reports API with windowed summary support.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis, type admin_reports_v1 } from "googleapis";
import { type z } from "zod";

import { MS_PER_DAY } from "@/lib/mcp/constants";
import {
  type ApiErrorResponse,
  createApiError,
  isApiError,
  logApiError,
  logApiRequest,
  logApiResponse,
} from "@/lib/mcp/errors";
import { type GetChromeEventsSchema } from "@/lib/mcp/schemas";

/**
 * Arguments for fetching Chrome audit events from the Admin SDK Reports API.
 */
export type ChromeEventsArgs = z.infer<typeof GetChromeEventsSchema>;
type Activity = admin_reports_v1.Schema$Activity;

interface ChromeEventsSuccess {
  events: Activity[];
  nextPageToken: string | null;
}

/**
 * Result of fetching Chrome audit events, either a list of events or an error.
 */
export type ChromeEventsResult = ChromeEventsSuccess | ApiErrorResponse;

/**
 * Fetch recent Chrome audit events from the Admin SDK Reports API.
 */
export async function getChromeEvents(
  auth: OAuth2Client,
  customerId: string,
  args: ChromeEventsArgs
): Promise<ChromeEventsResult> {
  const { maxResults = 50, startTime, endTime, pageToken } = args;

  logApiRequest("chrome-events", { maxResults, pageToken, startTime, endTime });

  const service = googleApis.admin({ version: "reports_v1", auth });

  try {
    const res = await service.activities.list({
      userKey: "all",
      applicationName: "chrome",
      maxResults,
      customerId,
      pageToken,
      startTime,
      endTime,
    });

    logApiResponse("chrome-events", {
      count: res.data.items?.length ?? 0,
      sample: res.data.items?.[0]?.id,
      nextPageToken: res.data.nextPageToken ?? null,
    });

    return {
      events: res.data.items ?? [],
      nextPageToken: res.data.nextPageToken ?? null,
    };
  } catch (error: unknown) {
    logApiError("chrome-events", error);
    return createApiError(error, "chrome-events");
  }
}

interface WindowSummaryConfig {
  windowDays: number;
  pageSize?: number;
  maxPages?: number;
  sampleSize?: number;
}

interface WindowSummaryResult {
  events: ChromeEventsResult;
  totalCount: number;
  sampled: boolean;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Fetch a summary of Chrome events over a time window.
 */
export async function getChromeEventsWindowSummary(
  auth: OAuth2Client,
  customerId: string,
  config: WindowSummaryConfig
): Promise<WindowSummaryResult> {
  const {
    windowDays,
    pageSize = 1000,
    maxPages = 10,
    sampleSize = 50,
  } = config;

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * MS_PER_DAY);
  const dayBuckets = buildDayBuckets(windowEnd, windowDays);

  const dayResults = await Promise.all(
    dayBuckets.map(async (bucket) => {
      const result = await fetchDayEvents(
        auth,
        customerId,
        bucket,
        pageSize,
        maxPages
      );
      return result;
    })
  );

  return aggregateDayResults(dayResults, sampleSize, windowStart, windowEnd);
}

interface DayBucket {
  dayStart: Date;
  dayEnd: Date;
}

/**
 * Creates day-by-day time buckets for parallel event fetching.
 */
function buildDayBuckets(windowEnd: Date, windowDays: number) {
  return Array.from({ length: windowDays }, (_, index) => {
    const dayEnd = new Date(windowEnd.getTime() - index * MS_PER_DAY);
    const dayStart = new Date(dayEnd.getTime() - MS_PER_DAY);
    return { dayStart, dayEnd };
  }).toSorted((a, b) => a.dayStart.getTime() - b.dayStart.getTime());
}

interface DayResult {
  error?: ApiErrorResponse;
  events?: Activity[];
  dayCount: number;
  daySampled: boolean;
}

/**
 * Fetches all events for a single day bucket with pagination.
 */
async function fetchDayEvents(
  auth: OAuth2Client,
  customerId: string,
  bucket: DayBucket,
  pageSize: number,
  maxPages: number
) {
  let pageToken: string | undefined;
  let dayCount = 0;
  const events: Activity[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const result = await getChromeEvents(auth, customerId, {
      maxResults: pageSize,
      pageToken,
      startTime: bucket.dayStart.toISOString(),
      endTime: bucket.dayEnd.toISOString(),
    });

    if (isApiError(result)) {
      return { error: result, dayCount: 0, daySampled: false };
    }

    const items = result.events ?? [];
    dayCount += items.length;
    events.push(...items);
    pageToken = result.nextPageToken ?? undefined;

    if (!result.nextPageToken) {
      break;
    }
  }

  return {
    events,
    dayCount,
    daySampled: pageToken !== undefined,
  };
}

/**
 * Combines results from all day buckets into a single summary.
 */
function aggregateDayResults(
  dayResults: DayResult[],
  sampleSize: number,
  windowStart: Date,
  windowEnd: Date
) {
  let totalCount = 0;
  let sampled = false;
  const allEvents: Activity[] = [];

  for (const result of dayResults) {
    if (result.error) {
      return {
        events: result.error,
        totalCount: 0,
        sampled: false,
        windowStart,
        windowEnd,
      };
    }

    totalCount += result.dayCount;
    sampled = sampled || result.daySampled;
    if (result.events) {
      allEvents.push(...result.events);
    }
  }

  return {
    events: {
      events: allEvents.slice(0, sampleSize),
      nextPageToken: null,
    },
    totalCount,
    sampled,
    windowStart,
    windowEnd,
  };
}
