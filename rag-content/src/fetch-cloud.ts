/**
 * Crawls Google Cloud Chrome Enterprise Premium documentation and writes as markdown files.
 */

import { CheerioCrawler, Configuration, type CheerioCrawlingContext } from "crawlee";

import type { RagDocument } from "./types.js";
import { getStandardId, slugify, turndown, writeDocuments } from "./utils.js";

const MAX_REQUESTS = 500;
const MAX_CONCURRENCY = 10;

/**
 * Generate a safe filename from a cloud docs URL path.
 */
function filenameFromUrl(url: string): string {
  const urlObj = new URL(url);
  const pathAfterPrefix = urlObj.pathname
    .replace(/^\/chrome-enterprise-premium\//, "")
    .replace(/\/$/, "");
  return slugify(pathAfterPrefix) || "index";
}

/**
 * Crawl Google Cloud Chrome Enterprise Premium docs and write as markdown files.
 */
export async function main(): Promise<void> {
  const documents: RagDocument[] = [];

  const config = new Configuration({
    persistStorage: false,
  });

  const crawler = new CheerioCrawler(
    {
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
            lastSegment.replaceAll("-", " ").replaceAll(/\b\w/g, (l) => l.toUpperCase()) ||
            "Untitled";
        }

        const content = turndown.turndown(articleHtml);

        if (title && title !== "Untitled" && content.trim()) {
          documents.push({
            filename: filenameFromUrl(request.url),
            title,
            url: articleId,
            kind: "cloud-docs",
            content,
            metadata: {},
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
    },
    config,
  );

  console.log("Starting cloud docs crawler...");
  await crawler.run(["https://cloud.google.com/chrome-enterprise-premium/docs/overview"]);

  writeDocuments("cloud-docs", documents);
  await crawler.teardown();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
