# news-digest: project notes

Reference for what this project is, how it is being built, and what has been
found so far. Last updated 2026-11-23, after chunk 2.

## What we are building

A personal daily news digest: articles from chosen sources, filtered to my
interests, useful to read and cheap to run.

The same flow is built three times so the approaches can be compared on the
same input:

1. **LLM workflow** (first): code controls every step; the model is called for
   single, narrow jobs.
2. **Single agent**: one model with tools decides its own steps.
3. **Multi-agent**: several agents split the work.

Goals beyond the app itself:

- Learn agentic building and the three flow styles by doing them.
- Keep the code tight and show good engineering habits.
- Possibly later: a deployable demo that shows the process without exposing
  the model or running up cost. Not in scope yet.

Topics to cover eventually: sports, feel-good stories, unbiased government
developments, company and market news, local news.

## How we work

- Built in small chunks, one at a time, so each is easy to read. A chunk that
  would exceed roughly 150 lines of diff gets split.
- I say what I want; Claude builds it with little input, makes small
  reversible calls itself and notes them, and asks before anything hard to
  undo or that changes scope, dependencies, or public interfaces.
- Every chunk ends with `npm run check` (typecheck, lint, tests) passing.
- One commit per chunk. Format: `type: short description`, imperative,
  lowercase, under 50 characters, no AI attribution.
- Chat replies stay on the one thing I raised.

## Stack

- TypeScript on Node 24, ES modules.
- Node runs the `.ts` files directly (built-in type stripping). No `tsx`, no
  build step. Imports therefore use `.ts` extensions, and `tsconfig.json` sets
  `allowImportingTsExtensions` and `erasableSyntaxOnly`.
- `zod` for schemas and types, `vitest` for tests, `eslint` with
  `typescript-eslint` for lint.
- `feedsmith` parses feeds (RSS, Atom, RDF, JSON Feed).
- `@anthropic-ai/sdk` is approved but not installed yet; it arrives with the
  first model call.
- Any other new dependency needs a yes first.

Commands:

| Command | What it does |
|---|---|
| `npm run digest` | Run the flow and print the digest. Uses the feeds in `feeds.json` when that file exists, otherwise the sample input |
| `npm run check` | Typecheck, lint, and tests |
| `npm run typecheck` / `lint` / `test` | Each check on its own |

## Planned workflow (flow 1)

From the original brief. My code controls every step.

1. **Fetch**: pull new items from RSS feeds. No model. Feeds often carry only
   snippets, so fetch each article URL and extract the text. Paywalled sites
   won't work.
2. **Dedupe**: store seen URLs in SQLite and skip repeats. No model.
3. **Score**: one cheap model call per article returns JSON with a relevance
   score (1-10) against a short description of my interests, plus a topic tag.
4. **Summarize**: one call per article above the threshold, 2-3 sentences.
5. **Compose**: turn the summaries into a brief grouped by topic, with links.

Optional sources later: Hacker News and GDELT (no key needed); keyword news
APIs (NewsData.io, NewsAPI.org) only for topics my feeds don't cover.

How it runs: a script on a schedule that writes an HTML file or emails the
brief. A small localhost web app only when interactivity is wanted.

Habits to keep:

- Log every model call and tool result so the traces can be read.
- Keep 10-20 real articles with known good answers as a test set.
- Cap agent iterations; use the cheap model for simple steps.

Cost estimate from the brief (Claude API list prices, per million tokens,
November 2026): Haiku 5.5 at $0.10 in / $0.50 out, Sonnet 5.5 at $2 / $10,
Batch API 50% off. For 50 articles a day at about 2,300 input and 150 output
tokens each: about $0.50 a month on Haiku, about $1 with Sonnet writing the
final brief, about $9 with Sonnet for everything.

Still undecided: the list of feeds, and how the brief is delivered (HTML file
or email).

## What exists now (chunk 1)

| File | Purpose |
|---|---|
| `src/core/types.ts` | Shared contract: `Article`, `Interest`, `DigestItem`, `Digest`, `FlowInput`, and the `Flow` interface (`run(input) -> Digest`) that all three implementations sit behind |
| `src/flows/workflow.ts` | The workflow pipeline: score, filter by threshold, summarize, compose. Score and summarize are stubs (keyword count, first sentence) with the signatures the model versions will keep |
| `src/fixtures/sample.ts` | Three fake articles and two interests |
| `src/cli.ts` | Runs the workflow on the samples and prints the digest |
| `tests/workflow.test.ts` | Four tests: schema match, grouping by topic, threshold filtering, empty result |
| `env.example` | Template for `.env` |

Decisions made in chunk 1:

- **Compose is plain code**, not a model call as in the brief. A
  model-written version can be added as its own chunk.
- **Package renamed** to `news-digest`. The folder is still `reader-digest`.

## Chunk 2: RSS fetch

| File | Purpose |
|---|---|
| `src/sources/rss.ts` | `fetchArticles(feedUrls)` fetches and parses feeds into `Article[]`, and lists the feeds that failed instead of stopping. `parseArticles` and `htmlToText` are the pure parts |
| `tests/rss.test.ts` | Four tests against inline feeds and a stub `fetch`; no network |
| `feeds.example.json` | Template feed list. The real list goes in `feeds.json`, which is gitignored |

Decisions made in chunk 2:

- **Fetching sits outside the flows.** It is a shared step that runs before
  any flow, and its output is the `articles` in `FlowInput`, so all three
  flows are compared on the same input. The agent flows can wrap the same
  function as a tool later if they should fetch on their own.
- **`feedsmith` instead of `rss-parser`**, which has had no release since
  April 2023.
- **Article text is the feed's own snippet for now**, with HTML stripped.
  Fetching each article URL for the full text is its own chunk.
- **A failed feed is reported and skipped**; the rest still run.

## Environment findings

Claude runs commands in a sandbox, which shapes a few things:

- **`.env` files are unreadable and unwritable for Claude.** The API key lives
  in `.env`, so I do the live model runs; Claude builds and tests against
  mocks. This is also why the template is named `env.example` rather than
  `.env.example`.
- **Claude cannot write `.claude/settings.json`.** Permission changes are mine
  to make.
- **`tsx` does not run in the sandbox** (it opens a local socket), which is
  why the project uses Node's built-in TypeScript support instead.
- **Network is filtered.** `registry.npmjs.org` works; other hosts (feeds,
  `api.anthropic.com`) are tried when first needed.
- **Node's `fetch` ignores the sandbox proxy by default.** Inside the sandbox
  a live fetch needs `NODE_USE_ENV_PROXY=1` and the host allowed for that
  command. Outside the sandbox nothing extra is needed.

## Open items

- Next in the fetch step: full article text from each URL, then dedupe of
  seen URLs in SQLite.
- The real feed list (`feeds.json`) is still to be written.
- `.env` loading gets wired into the CLI in the chunk that makes the first
  model call.
