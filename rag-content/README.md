# rag-content

Fetches Chrome Enterprise documentation from three sources and saves each document as a markdown file with YAML front matter, ready for RAG ingestion.

## Quickstart

```bash
# 1. Clone and install
git clone <repo-url>
cd cep-hero/rag-content
npm install
```

Before fetching, you need fresh browser headers for the help center crawler. Without them, Google's support site will return 429 rate limit errors.

```bash
# 2. Get fresh headers
#    a. Open Chrome and sign in to your Google Workspace / corp account
#    b. Visit https://support.google.com/chrome/a
#    c. Open DevTools (F12) > Network tab
#    d. Reload the page
#    e. Right-click the first document request > Copy > Copy as fetch
#    f. Open src/fetch-helpcenter.ts and replace the `headers` object
#       (around line 146) with the headers from the copied fetch call

# 3. Fetch all content
npm run fetch:all
```

This will populate three directories with markdown files:

```
policies/       ~2000+ Chrome Enterprise policy docs
helpcenter/     Google Support help center articles
cloud-docs/     Google Cloud Chrome Enterprise Premium docs
```

## Fetchers

### `npm run fetch:policies`

Fetches the [Chrome Enterprise policy templates JSON](https://chromeenterprise.google/static/json/policy_templates_en-US.json) — a single public API call, no authentication needed. Generates one markdown file per policy (~2000+) with full metadata including supported platforms, feature flags, configuration type, example values, and tags.

**Output:** `policies/<policy-name>.md`

```yaml
---
title: Allow Dinosaur Easter Egg
url: https://chromeenterprise.google/policies/#AllowDinosaurEasterEgg
kind: chrome-enterprise-policy
fetchedAt: 2026-04-03T12:00:00.000Z
policyId: 196
policyName: AllowDinosaurEasterEgg
deprecated: false
deviceOnly: false
supportedPlatformsText: Google Chrome on Windows version 48 and later, ...
tags:
  - system
features:
  dynamicRefresh: true
  perProfile: true
  canBeRecommended: true
  canBeMandatory: true
  cloudOnly: false
  userOnly: false
---
```

### `npm run fetch:helpcenter`

Crawls Google Support help center articles for Chrome Enterprise admin documentation. Uses [Crawlee](https://crawlee.dev/) with CheerioCrawler to spider from a set of seed URLs, following links within `support.google.com/chrome/a` and `support.google.com/a`. Extracts article HTML and converts to markdown via Turndown.

**Output:** `helpcenter/answer-<id>.md` or `helpcenter/topic-<id>.md`

```yaml
---
title: Set Chrome policies for users or browsers
url: https://support.google.com/chrome/a/answer/9037717
kind: admin-docs
fetchedAt: 2026-04-03T12:00:00.000Z
articleType: answer
articleId: "9037717"
---
```

> **This fetcher requires fresh browser headers.** See [Updating Headers](#updating-headers-before-crawling) below.

### `npm run fetch:cloud`

Crawls Google Cloud documentation for Chrome Enterprise Premium, starting from the [overview page](https://cloud.google.com/chrome-enterprise-premium/docs/overview) and following links within the `/chrome-enterprise-premium/` path. Extracts content from `.devsite-article-body` elements and converts to markdown.

**Output:** `cloud-docs/<path-slug>.md`

```yaml
---
title: Chrome Enterprise Premium overview
url: https://cloud.google.com/chrome-enterprise-premium/docs/overview
kind: cloud-docs
fetchedAt: 2026-04-03T12:00:00.000Z
---
```

### `npm run fetch:all`

Runs all three fetchers in sequence.

## Updating Headers Before Crawling

The help center crawler (`fetch:helpcenter`) sends browser-like HTTP headers with each request. Google's support site rate-limits requests that don't look like real browser traffic, returning **429 Too Many Requests**. The headers hardcoded in `src/fetch-helpcenter.ts` will go stale over time as Google rotates what it expects.

**You must update these headers before each crawl run:**

1. Open https://support.google.com/chrome/a in Chrome, logged into a corp/workspace account
2. Open DevTools > **Network** tab
3. Reload the page
4. Right-click the first document request > **Copy** > **Copy as fetch**
5. Extract the `headers` object from the copied fetch call
6. Replace the `headers` constant in `src/fetch-helpcenter.ts` with the new values

If the crawler hits 429 errors, it will print a detailed warning at the end of the run with these same instructions. Stale headers are almost always the cause.

The policies fetcher and cloud docs fetcher do **not** need header updates — they use standard unauthenticated requests.

## Building the Database

Once you've fetched content, build a SQLite database with full-text search:

```bash
npm run build:db
```

This reads all `.md` files from `policies/`, `helpcenter/`, `cloud-docs/`, and `curated/`, parses their front matter and body, and writes `rag-content.db`.

The database has two tables:

- **`documents`** — one row per markdown file with front matter fields as columns, the markdown body as `content`, and a `kind` column (the source directory name)
- **`documents_fts`** — an FTS5 virtual table for full-text search over `title`, `content`, and `kind`, using the Porter stemmer

Query examples:

```sql
-- Full-text search
SELECT d.title, d.url, d.kind, rank
FROM documents_fts f
JOIN documents d ON d.id = f.rowid
WHERE documents_fts MATCH 'password policy'
ORDER BY rank;

-- Filter by kind
SELECT title, url FROM documents WHERE kind = 'policies' AND deprecated = 0;

-- Search within a specific kind
SELECT d.title, d.url
FROM documents_fts f
JOIN documents d ON d.id = f.rowid
WHERE documents_fts MATCH 'kind:policies password';
```

The `curated/` directory is for manually authored markdown files. Same format as the fetched content — YAML front matter with at least `title`, then markdown body. They'll be indexed alongside everything else with `kind = "curated"`.

The database is rebuilt from scratch on each run (idempotent, same as the fetchers).

## Idempotency

Every fetcher clears its entire output directory before writing. Re-running produces a clean set of files with no stale leftovers. Safe to run on a schedule or re-run at any time.

## Development

```bash
npm run check     # prettier check + eslint + tsc --noEmit
npm run fix       # auto-fix formatting and lint issues
npm run lint      # eslint only
npm run format    # prettier only
```
