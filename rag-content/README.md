# rag-content

Standalone tool that fetches Chrome Enterprise documentation and saves it as markdown files with YAML front matter. Designed for RAG (Retrieval-Augmented Generation) pipelines.

100% independent from the main cep-hero application — runs with npm and tsx, no Bun required.

## Setup

```bash
cd rag-content
npm install
```

## Usage

```bash
# Fetch everything
npm run fetch:all

# Or fetch individually
npm run fetch:policies      # Chrome Enterprise policy definitions
npm run fetch:helpcenter    # Google Support help center articles
npm run fetch:cloud         # Google Cloud Chrome Enterprise Premium docs
```

## Output

Each fetcher writes markdown files to its own output directory:

```
rag-content/
  policies/          # ~2000+ policy .md files
  helpcenter/        # help center article .md files
  cloud-docs/        # cloud documentation .md files
```

Every file includes YAML front matter:

```yaml
---
title: Allow Dinosaur Easter Egg
url: https://chromeenterprise.google/policies/#AllowDinosaurEasterEgg
kind: chrome-enterprise-policy
fetchedAt: 2026-04-03T00:00:00.000Z
policyId: 196
policyName: AllowDinosaurEasterEgg
deprecated: false
tags:
  - system
---

# Allow Dinosaur Easter Egg
...
```

Output directories are gitignored. Runs are **idempotent** — each fetch clears its output directory before writing, so re-runs never accumulate stale files.

## Content Sources

| Fetcher | Source | Output |
|---------|--------|--------|
| `fetch:policies` | [Chrome Enterprise policy JSON](https://chromeenterprise.google/static/json/policy_templates_en-US.json) | `policies/<policy-name>.md` |
| `fetch:helpcenter` | Google Support help center crawl | `helpcenter/answer-<id>.md` |
| `fetch:cloud` | Google Cloud docs crawl | `cloud-docs/<slug>.md` |

## Help Center: Updating Headers

The help center crawler requires fresh browser headers to avoid 429 rate limits. **Update headers before each run:**

1. Open https://support.google.com/chrome/a in Chrome (logged into a corp account)
2. Open DevTools > Network tab
3. Right-click the initial page request > **Copy as fetch**
4. Replace the `headers` object in `src/fetch-helpcenter.ts` with the copied values

The script prints a reminder banner on each run. If you hit 429 errors, this is almost always the fix.

## Development

```bash
npm run check          # format check + lint + typecheck
npm run fix            # auto-fix format + lint issues
npm run lint           # eslint only
npm run format         # prettier only
```
