/**
 * IMPORTANT: RATE LIMITING AND SESSION HEADERS
 *
 * If you encounter 429 Too Many Requests errors, you need to refresh the
 * session headers. This typically occurs when running off-corp without a valid
 * session.
 *
 * To resolve:
 * 1. Log in to support.google.com on a corp account.
 * 2. Copy the request headers from a successful page load.
 * 3. Update the 'headers' constant below.
 *
 * See detailed instructions near the 'headers' constant below.
 */
import { CheerioCrawler, type CheerioCrawlingContext } from "crawlee";

import { getStandardId, processDocs, turndown } from "./utils";
import { type Document, MAX_CONCURRENCY, MAX_REQUESTS } from "./vector-types";

type ArticleType = "answer" | "topic";

/**
 * Extract a title string from a Cheerio element.
 */
function extractCleanTitle(element: unknown, url: string): string {
  const title = getElementText(element);
  if (title) {
    return title.replace(/\s+/g, " ").trim();
  }

  const match = url.match(/\/(answer|topic)\/(\d+)/);
  return match ? `Article ${match[2]}` : "Untitled";
}

/**
 * Extract helpcenter metadata from a URL.
 */
function extractHelpcenterMetadata(url: string) {
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
 * Parse article type from a string segment.
 */
function parseArticleType(value: string | undefined): ArticleType | undefined {
  if (value === "answer" || value === "topic") {
    return value;
  }

  return undefined;
}

/**
 * Read text content from an element-like object.
 */
function getElementText(element: unknown): string | null {
  if (!element || typeof element !== "object") {
    return null;
  }

  const textFn = Reflect.get(element, "text");
  if (typeof textFn !== "function") {
    return null;
  }

  try {
    const text = textFn.call(element);
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

function cleanHtml(html: string): string {
  return html.split(/Was this helpful\?/i)[0] || html;
}

/**
 * Helper to allow pasting full fetch options object or just the headers.
 * If user pastes: { "headers": { ... }, "method": "GET" }
 * This extracts the inner "headers" object.
 */
function resolveHeaders(input: any) {
  if (
    input &&
    typeof input === "object" &&
    "headers" in input &&
    typeof input.headers === "object"
  ) {
    return input.headers;
  }
  return input;
}

/**
 * INSTRUCTIONS FOR UPDATING HEADERS
 *
 * 1. Visit https://support.google.com from your corp account.
 * 2. Resolve any CAPTCHA if prompted and refresh.
 * 3. Open DevTools (Network tab), find the main doc request.
 * 4. Right-click -> Copy -> Copy as fetch.
 * 5. Extract the 'headers' object and paste it below.
 *
 * Video: https://screencast.googleplex.com/cast/NTgyNzMyOTE3NDUzNjE5Mnw4NmFjYzgwYi04Yw
 */
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

async function main() {
  const documents: Document[] = [];
  const INSTRUCTION_MESSAGE = `
TOO MANY REQUESTS (429) DETECTED

Rate limiting typically occurs when off-corp and not logged in. Log in to a
corp account to bypass.

1. Visit https://support.google.com from your corp account.
2. Resolve any captcha, refresh.
3. Open dev tools -> Network tab.
4. Right click the page request -> Copy as Fetch.
5. Paste the headers into the 'headers' constant in scripts/index-helpcenter.ts.

Video: https://screencast.googleplex.com/cast/NTgyNzMyOTE3NDUzNjE5Mnw4NmFjYzgwYi04Yw
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

    failedRequestHandler({ request, error }) {
      // Check for 429 in both standard error object and Crawlee/got response
      const statusCode =
        error?.response?.statusCode ??
        error?.statusCode;

      if (statusCode === 429) {
        console.error(INSTRUCTION_MESSAGE);
      }
      console.log(`Failed to crawl: ${request.url}`);
    },

    async requestHandler({
      request,
      response,
      $,
      enqueueLinks,
    }: CheerioCrawlingContext) {
      if (response.statusCode === 429) {
        console.error(INSTRUCTION_MESSAGE);
        return;
      }

      // Validate URL structure before processing
      const url = new URL(request.url);
      // Allow: /chrome/a, /chrome/a/answer/123, /chrome/a/topic/123, /a/answer/123, /a/topic/123
      const validPattern = /^\/(chrome\/)?a(\/((answer|topic)\/\d+)?)?$/;

      if (!validPattern.test(url.pathname)) {
        console.log(`Skipping malformed URL: ${request.url}`);
        return;
      }

      const articleHtml = $("article").html() ?? "";
      const cleaned = cleanHtml(articleHtml);

      // Only process pages with actual numeric IDs for content extraction
      if (!request.url.match(/\/(answer|topic)\/(\d+)/)) {
        console.log(
          `Topic/category page (no content extraction): ${request.url}`
        );
        // Still enqueue links from topic pages but don't extract content
        await enqueueLinks({
          globs: [
            "https://support.google.com/chrome/a",
            "https://support.google.com/chrome/a/answer/*",
            "https://support.google.com/a/answer/*",
            "https://support.google.com/chrome/a/topic/*",
            "https://support.google.com/a/topic/*",
          ],
          selector: "article a[href]",
          transformRequestFunction: (req) => {
            try {
              const url = new URL(req.url);

              // Validate it's a Google Support URL
              if (!url.hostname.includes("support.google.com")) {
                return false;
              }

              // Validate the URL path structure to prevent malformed URLs
              const path = url.pathname;
              const validPattern =
                /^\/(chrome\/)?a(\/((answer|topic)\/\d+)?)?$/;

              if (!validPattern.test(path)) {
                return false;
              }

              // Clean the URL
              url.search = "";
              url.hash = "";
              req.url = url.toString();
              return req;
            } catch {
              return false;
            }
          },
          limit: 200,
        });
        return;
      }

      const articleId = getStandardId(request.url);
      const title = extractCleanTitle($("h1"), request.url);
      const helpcenterMetadata = extractHelpcenterMetadata(request.url);
      const content = turndown.turndown(cleaned);

      documents.push({
        id: articleId,
        content,
        kind: "admin-docs",
        url: articleId,
        title,
        metadata: helpcenterMetadata,
      });
      console.log(`Crawled: ${title}`);

      // Enqueue links from content pages
      await enqueueLinks({
        globs: [
          "https://support.google.com/chrome/a",
          "https://support.google.com/chrome/a/answer/*",
          "https://support.google.com/a/answer/*",
          "https://support.google.com/chrome/a/topic/*",
          "https://support.google.com/a/topic/*",
        ],
        selector: "article a[href]",
        transformRequestFunction: (req) => {
          try {
            const url = new URL(req.url);

            // Validate it's a Google Support URL
            if (!url.hostname.includes("support.google.com")) {
              return false;
            }

            // Validate the URL path structure to prevent malformed URLs
            const path = url.pathname;
            const validPattern = /^\/(chrome\/)?a(\/((answer|topic)\/\d+)?)?$/;

            if (!validPattern.test(path)) {
              return false;
            }

            // Clean the URL
            url.search = "";
            url.hash = "";
            req.url = url.toString();
            return req;
          } catch {
            return false;
          }
        },
        limit: 200,
      });
    },
  });

  console.log("Starting crawler...");
  await crawler.run([
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
  ]);

  await processDocs(documents);
  await crawler.teardown();
}

main().catch(console.error);
