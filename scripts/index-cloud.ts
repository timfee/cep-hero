import type { CheerioCrawlingContext } from "crawlee";

import { CheerioCrawler } from "crawlee";

import type { Document } from "./vector-types";

import { getStandardId, processDocs, turndown } from "./utils";
import { MAX_CONCURRENCY, MAX_REQUESTS } from "./vector-types";

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

    async requestHandler({ request, $, enqueueLinks }: CheerioCrawlingContext) {
      const articleHtml = $("div.devsite-article-body").html() ?? "";
      const articleId = getStandardId(request.url);

      // Better title extraction for Google Cloud docs
      let title = "";

      // Try h1.devsite-page-title first and get only direct text nodes
      const h1Element = $("h1.devsite-page-title").first();
      if (h1Element.length) {
        title = h1Element.text().trim();
      }

      // Fallback to regular h1 if no devsite-page-title
      if (!title) {
        const h1 = $("h1").first();
        if (h1.length) {
          title = h1.text().trim();
        }
      }

      // Fallback to page title
      if (!title) {
        title = $("title").first().text().split(" | ")[0].trim();
      }

      // Final URL-based fallback
      if (!title) {
        const urlPath = new URL(request.url).pathname;
        const pathSegments = urlPath.split("/").filter(Boolean);
        title =
          pathSegments
            .at(-1)
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
        console.log(`✓ Crawled: ${title}`);
      } else {
        console.log(
          `⚠️ Skipping page with insufficient content: ${request.url}`
        );
      }

      await enqueueLinks({
        globs: ["**/chrome-enterprise-premium/**"],
        transformRequestFunction: (req) => {
          try {
            const url = new URL(req.url);

            // Skip non-content URLs
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

            // Clean the URL
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

main().catch(console.error);
