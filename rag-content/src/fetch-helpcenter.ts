/**
 * Crawls Google Support help center articles for Chrome Enterprise and writes them as markdown files.
 */

import { CheerioCrawler, type CheerioCrawlingContext } from "crawlee";

import type { RagDocument } from "./types.js";
import { cleanHtml, getStandardId, slugify, turndown, writeDocuments } from "./utils.js";

type ArticleType = "answer" | "topic";

interface CrawleeError extends Error {
  statusCode?: number;
  response?: {
    statusCode?: number;
  };
}

const MAX_REQUESTS = 500;
const MAX_CONCURRENCY = 10;


/**
 * Extract a clean title from a Cheerio element or URL.
 */
function extractCleanTitle(element: unknown, url: string): string {
  const title = getElementText(element);
  if (title) {
    return title.replaceAll(/\s+/g, " ").trim();
  }

  const match = url.match(/\/(answer|topic)\/(\d+)/);
  return match ? `Article ${match[2]}` : "Untitled";
}


/**
 * Extract helpcenter metadata from a URL.
 */
function extractHelpcenterMetadata(url: string): {
  articleType?: ArticleType;
  articleId?: string;
} {
  const urlMatch = url.match(/\/(answer|topic)\/(\d+)/);
  if (urlMatch) {
    const articleType = parseArticleType(urlMatch[1]);
    return {
      articleType,
      articleId: urlMatch[2],
    };
  }
  return {};
}


/**
 * Parse article type from a URL segment.
 */
function parseArticleType(value: string | undefined): ArticleType | undefined {
  if (value === "answer" || value === "topic") {
    return value;
  }
  return undefined;
}


/**
 * Read text content from a Cheerio-like element.
 */
function getElementText(element: unknown): string | null {
  if (element === null || typeof element !== "object") {
    return null;
  }

  if (isRecord(element)) {
    const textFn = element.text;
    if (typeof textFn === "function") {
      try {
        const text = textFn.call(element);
        return typeof text === "string" ? text : null;
      } catch {
        return null;
      }
    }
  }

  return null;
}


/**
 * Resolve headers from a fetch options object or headers directly.
 */
function resolveHeaders(input: unknown): Record<string, string> {
  if (isRecord(input) && isRecord(input.headers)) {
    return coerceHeaders(input.headers);
  }
  if (isRecord(input)) {
    return coerceHeaders(input);
  }
  return {};
}


/**
 * Coerce header values to strings.
 */
function coerceHeaders(
  value: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}


/**
 * Type guard for plain objects.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


/**
 * Type guard for Crawlee error objects.
 */
function isCrawleeError(error: unknown): error is CrawleeError {
  return isRecord(error);
}


/**
 * Generate a safe filename from a help center URL.
 */
function filenameFromUrl(url: string): string {
  const match = url.match(/\/(answer|topic)\/(\d+)/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return slugify(new URL(url).pathname);
}


const headers = resolveHeaders({
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "accept-language": "en-US,en;q=0.9",
  priority: "u=0, i",
  "sec-ch-ua":
    '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "iframe",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-site",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  "x-browser-channel": "stable",
  "x-browser-year": "2026",
  Referer: "https://support.google.com/",
}) satisfies Record<string, string>;

const VALID_PATTERN = /^\/(chrome\/)?a(\/((answer|topic)\/\d+)?)?$/;

const ENQUEUE_GLOBS = [
  "https://support.google.com/chrome/a",
  "https://support.google.com/chrome/a/answer/*",
  "https://support.google.com/a/answer/*",
  "https://support.google.com/chrome/a/topic/*",
  "https://support.google.com/a/topic/*",
];

const SEED_URLS = [
  "https://support.google.com/chrome/a",
  "https://support.google.com/a/answer/10026322",
  "https://support.google.com/a/answer/10840369",
  "https://support.google.com/a/answer/11068433",
  "https://support.google.com/a/answer/11368990",
  "https://support.google.com/a/answer/11560430",
  "https://support.google.com/a/answer/12642329",
  "https://support.google.com/a/answer/12642752",
  "https://support.google.com/a/answer/12642828",
  "https://support.google.com/a/answer/12643733",
  "https://support.google.com/a/answer/13447476",
  "https://support.google.com/a/answer/13790448",
  "https://support.google.com/a/answer/14914403",
  "https://support.google.com/a/answer/15178509",
  "https://support.google.com/a/answer/16118940",
  "https://support.google.com/a/answer/16244319",
  "https://support.google.com/a/answer/16409481",
  "https://support.google.com/a/answer/16479560",
  "https://support.google.com/a/answer/9184226",
  "https://support.google.com/a/answer/9261439",
  "https://support.google.com/a/answer/9262032",
  "https://support.google.com/a/answer/9275380",
  "https://support.google.com/a/answer/9394107",
  "https://support.google.com/a/answer/9587667",
  "https://support.google.com/a/answer/9668676",
  "https://support.google.com/a/topic/10742486",
  "https://support.google.com/a/topic/11399553",
  "https://support.google.com/a/topic/7492529",
  "https://support.google.com/a/topic/7556597",
  "https://support.google.com/a/topic/7558840",
  "https://support.google.com/a/topic/9061731",
  "https://support.google.com/a/topic/9105077",
];


/**
 * Transform and filter enqueued links to valid help center URLs.
 */
function transformRequest(req: { url: string }): { url: string } | false {
  try {
    const url = new URL(req.url);

    if (!url.hostname.includes("support.google.com")) {
      return false;
    }

    if (!VALID_PATTERN.test(url.pathname)) {
      return false;
    }

    url.search = "";
    url.hash = "";
    req.url = url.toString();
    return req;
  } catch {
    return false;
  }
}


/**
 * Crawl Google Support help center and write articles as markdown files.
 */
export async function main(): Promise<void> {
  const documents: RagDocument[] = [];
  const INSTRUCTION_MESSAGE = `
TOO MANY REQUESTS (429) DETECTED

Rate limiting typically occurs when off-corp and not logged in. Log in to a
corp account to bypass.

1. Visit https://support.google.com from your corp account.
2. Resolve any captcha, refresh.
3. Open dev tools -> Network tab.
4. Right click the page request -> Copy as Fetch.
5. Paste the headers into the 'headers' constant in src/fetch-helpcenter.ts.
`;

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: MAX_REQUESTS,
    maxConcurrency: MAX_CONCURRENCY,

    preNavigationHooks: [
      ({ request }, gotOptions) => {
        gotOptions.http2 = false;
        request.headers = headers;
      },
    ],

    failedRequestHandler({ request, error: rawError }) {
      const error = isCrawleeError(rawError) ? rawError : undefined;
      const statusCode = error?.response?.statusCode ?? error?.statusCode;

      if (statusCode === 429) {
        console.error(INSTRUCTION_MESSAGE);
      }
      console.log(`Failed to crawl: ${request.url}`);
    },

    async requestHandler(context: CheerioCrawlingContext) {
      const { request, response, $, enqueueLinks } = context;
      if (response.statusCode === 429) {
        console.error(INSTRUCTION_MESSAGE);
        return;
      }

      const url = new URL(request.url);
      if (!VALID_PATTERN.test(url.pathname)) {
        console.log(`Skipping malformed URL: ${request.url}`);
        return;
      }

      const articleHtml = $("article").html() ?? "";
      const cleaned = cleanHtml(articleHtml);

      if (!/\/(answer|topic)\/(\d+)/.test(request.url)) {
        console.log(
          `Topic/category page (no content extraction): ${request.url}`,
        );
        await enqueueLinks({
          globs: ENQUEUE_GLOBS,
          selector: "article a[href]",
          transformRequestFunction: transformRequest,
          limit: 200,
        });
        return;
      }

      const articleId = getStandardId(request.url);
      const title = extractCleanTitle($("h1"), request.url);
      const helpcenterMetadata = extractHelpcenterMetadata(request.url);
      const content = turndown.turndown(cleaned);

      documents.push({
        filename: filenameFromUrl(request.url),
        title,
        url: articleId,
        kind: "admin-docs",
        content,
        metadata: helpcenterMetadata,
      });
      console.log(`Crawled: ${title}`);

      await enqueueLinks({
        globs: ENQUEUE_GLOBS,
        selector: "article a[href]",
        transformRequestFunction: transformRequest,
        limit: 200,
      });
    },
  });

  console.log("Starting help center crawler...");
  await crawler.run(SEED_URLS);

  writeDocuments("helpcenter", documents);
  await crawler.teardown();
}


if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
