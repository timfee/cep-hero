/**
 * Chrome audit event fetching from Admin SDK Reports API with windowed summary support.
 */

import { type OAuth2Client } from "google-auth-library";
import { google as googleApis, type admin_reports_v1 } from "googleapis";
import { type z } from "zod";

import { createApiError, getErrorDetails } from "@/lib/mcp/errors";
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

interface ChromeEventsError {
  error: string;
  suggestion: string;
  requiresReauth: boolean;
}

/**
 * Result of fetching Chrome audit events, either a list of events or an error.
 */
export type ChromeEventsResult = ChromeEventsSuccess | ChromeEventsError;

/**
 * Fetch recent Chrome audit events from the Admin SDK Reports API.
 */
export async function getChromeEvents(
  auth: OAuth2Client,
  customerId: string,
  args: ChromeEventsArgs
): Promise<ChromeEventsResult> {
  const { maxResults = 50, startTime, endTime, pageToken } = args;

  console.log("[chrome-events] request", {
    maxResults,
    pageToken,
    startTime,
    endTime,
  });

  const service = googleApis.admin({
    version: "reports_v1",
    auth,
  });

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

    console.log(
      "[chrome-events] response",
      JSON.stringify({
        count: res.data.items?.length ?? 0,
        sample: res.data.items?.[0]?.id,
        nextPageToken: res.data.nextPageToken ?? null,
      })
    );

    return {
      events: res.data.items ?? [],
      nextPageToken: res.data.nextPageToken ?? null,
    };
  } catch (error: unknown) {
    const { code, message, errors } = getErrorDetails(error);
    console.log(
      "[chrome-events] error",
      JSON.stringify({ code, message, errors })
    );
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
  const windowStart = new Date(windowEnd.getTime() - windowDays * 86_400_000);
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
    const dayEnd = new Date(windowEnd.getTime() - index * 86_400_000);
    const dayStart = new Date(dayEnd.getTime() - 86_400_000);
    return { dayStart, dayEnd };
  }).toSorted((a, b) => a.dayStart.getTime() - b.dayStart.getTime());
}

interface DayResult {
  error?: ChromeEventsError;
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
  const state = { pageToken: undefined as string | undefined, dayCount: 0 };
  const events: Activity[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchSinglePage(
      auth,
      customerId,
      bucket,
      pageSize,
      state.pageToken
    );
    if ("error" in result) {
      return { error: result, dayCount: 0, daySampled: false };
    }
    const processed = processPageResult(result, events, state);
    if (processed.done) {
      break;
    }
  }

  return {
    events,
    dayCount: state.dayCount,
    daySampled: state.pageToken !== undefined,
  };
}

/**
 * Fetches a single page of events from the Reports API.
 */
async function fetchSinglePage(
  auth: OAuth2Client,
  customerId: string,
  bucket: DayBucket,
  pageSize: number,
  pageToken: string | undefined
) {
  const result = await getChromeEvents(auth, customerId, {
    maxResults: pageSize,
    pageToken,
    startTime: bucket.dayStart.toISOString(),
    endTime: bucket.dayEnd.toISOString(),
  });
  return result;
}

/**
 * Accumulates page results and updates pagination state.
 */
function processPageResult(
  result: ChromeEventsSuccess,
  events: Activity[],
  state: { pageToken: string | undefined; dayCount: number }
) {
  const items = result.events ?? [];
  state.dayCount += items.length;
  events.push(...items);
  state.pageToken = result.nextPageToken ?? undefined;
  return { done: result.nextPageToken === null };
}

interface AggregationState {
  totalCount: number;
  sampled: boolean;
  allEvents: Activity[];
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
  const state: AggregationState = {
    totalCount: 0,
    sampled: false,
    allEvents: [],
  };

  for (const result of dayResults) {
    const errorResult = checkForError(result, windowStart, windowEnd);
    if (errorResult !== null) {
      return errorResult;
    }
    accumulateResult(result, state);
  }

  return buildSuccessResult(state, sampleSize, windowStart, windowEnd);
}

/**
 * Returns an error result if the day fetch failed.
 */
function checkForError(result: DayResult, windowStart: Date, windowEnd: Date) {
  if (result.error === undefined) {
    return null;
  }
  return {
    events: result.error,
    totalCount: 0,
    sampled: false,
    windowStart,
    windowEnd,
  };
}

/**
 * Adds a day's events to the aggregation state.
 */
function accumulateResult(result: DayResult, state: AggregationState) {
  state.totalCount += result.dayCount;
  state.sampled = state.sampled || result.daySampled;
  if (result.events !== undefined) {
    state.allEvents.push(...result.events);
  }
}

/**
 * Builds the final success result with sampled events.
 */
function buildSuccessResult(
  state: AggregationState,
  sampleSize: number,
  windowStart: Date,
  windowEnd: Date
) {
  return {
    events: {
      events: state.allEvents.slice(0, sampleSize),
      nextPageToken: null,
    },
    totalCount: state.totalCount,
    sampled: state.sampled,
    windowStart,
    windowEnd,
  };
}
