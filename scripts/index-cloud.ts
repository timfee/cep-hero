/**
 * Crawls Google Cloud Chrome Enterprise Premium documentation and indexes to Upstash Vector.
 */

import { CheerioCrawler, type CheerioCrawlingContext } from "crawlee";

import { getStandardId, processDocs, turndown } from "./utils";
import { MAX_CONCURRENCY, MAX_REQUESTS, type Document } from "./vector-types";

/**
 * Main crawler entry point.
 */
async function main() {
  const documents: Document[] = [];

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: MAX_REQUESTS,
    maxConcurrency: MAX_CONCURRENCY,

    preNavigationHooks: [
      (_, gotOptions) => {
        gotOptions.http2 = false;
      },
    ],

    async requestHandler(context: CheerioCrawlingContext) {
      const { request, $, enqueueLinks } = context;
      const articleHtml = $("div.devsite-article-body").html() ?? "";
      const articleId = getStandardId(request.url);

      let title = "";

      const h1Element = $("h1.devsite-page-title").first();
      if (h1Element.length) {
        title = h1Element.text().trim();
      }

      if (!title) {
        const h1 = $("h1").first();
        if (h1.length) {
          title = h1.text().trim();
        }
      }

      if (!title) {
        title = $("title").first().text().split(" | ")[0].trim();
      }

      if (!title) {
        const urlPath = new URL(request.url).pathname;
        const pathSegments = urlPath.split("/").filter(Boolean);
        const lastSegment = pathSegments.at(-1) ?? "";
        title =
          lastSegment
            .replaceAll("-", " ")
            .replaceAll(/\b\w/g, (l) => l.toUpperCase()) || "Untitled";
      }

      const content = turndown.turndown(articleHtml);

      if (title && title !== "Untitled" && content.trim()) {
        documents.push({
          id: articleId,
          content,
          kind: "cloud-docs",
          url: articleId,
          title,
        });
        console.log(`Crawled: ${title}`);
      } else {
        console.log(`Skipping page with insufficient content: ${request.url}`);
      }

      await enqueueLinks({
        globs: ["**/chrome-enterprise-premium/**"],
        transformRequestFunction: (req) => {
          try {
            const url = new URL(req.url);

            const path = url.pathname;
            if (
              path.includes("/reference/") ||
              path.includes("/samples/") ||
              path.includes("/quotas") ||
              path.endsWith("/") ||
              path.includes("#")
            ) {
              return false;
            }

            url.search = "";
            url.hash = "";
            req.url = url.toString();
            return req;
          } catch {
            return false;
          }
        },
      });
    },
  });

  console.log("Starting crawler...");
  await crawler.run([
    "https://cloud.google.com/chrome-enterprise-premium/docs/overview",
  ]);

  await processDocs(documents);
  await crawler.teardown();
}

try {
  await main();
} catch (error) {
  console.error(error);
}
