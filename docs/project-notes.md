# news-digest: project notes

Reference for what this project is, how it is being built, and what has been
found so far. Last updated 2026-11-23, after chunk 13.

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
- One commit per chunk, on a feature branch that is pushed and opened as a
  pull request, then reviewed before it is merged into `main`. Format: `type: short description`, imperative,
  lowercase, under 50 characters, no AI attribution.
- Chat replies stay on the one thing I raised.

## Stack

- TypeScript on Node 24, ES modules.
- Node runs the `.ts` files directly (built-in type stripping). No `tsx`, no
  build step. Imports therefore use `.ts` extensions, and `tsconfig.json` sets
  `allowImportingTsExtensions` and `erasableSyntaxOnly`.
- `#/` is an alias for `src/`, so `#/store.ts` replaces `../../../store.ts`.
  It is declared under `imports` in `package.json` rather than as tsconfig
  `paths`, because Node resolves `imports` itself and ignores `paths`. Files
  in the same folder still import each other with `./`.
- `zod` for schemas and types, `vitest` for tests, `eslint` with
  `typescript-eslint` for lint.
- `feedsmith` parses feeds (RSS, Atom, RDF, JSON Feed).
- `next` and `react` render the web view; `@tanstack/react-query` caches the
  digest in the browser.
- `@anthropic-ai/sdk` makes the model calls, through `src/llm/client.ts` only.
- Any other new dependency needs a yes first.

Commands:

| Command | What it does |
|---|---|
| `npm run dev` | Start the web view at `http://localhost:3000` |
| `npm run build` | Production build of the web view |
| `npm run digest` | Force a run now: fetch, run the flow, add the result to the stored feed, and print it. Uses the feeds in `feeds.json` and the interests in `interests.json` when those files exist, otherwise the sample input. Prints progress as it goes |
| `npm run check` | Typecheck, lint, and tests |
| `npm run typecheck` / `lint` / `test` | Each check on its own |
| `npm run leakscan` | Scan staged files for secrets and personal details. `-- --all` scans every tracked file |

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

## Chunk 3: leak guards

The repo is public, so secrets and personal details are stopped in layers.

| Layer | What it does |
|---|---|
| `tools/leakscan/` | Scanner with no dependencies. Flags email addresses, home-folder paths, API tokens, private keys, SSNs, data and key file types, files over 500 kB, and any word listed in `.private-terms`. Reports file, line, and rule, never the matched text |
| `.private-terms` | Gitignored list of private words (names, usernames, places), one per line. CI reads the same list from the `LEAKSCAN_TERMS` repository secret |
| `.githooks/pre-commit` | Runs the scanner on staged files. Enabled per clone with `git config core.hooksPath .githooks` |
| `.gitignore` | Keeps data, log, and key files from being staged |
| `.github/workflows/check.yml` | Runs `npm run check` and the scanner over every tracked file on pull requests and on pushes to `main`, because a local hook can be skipped |

Decisions made in chunk 3:

- **A small scanner instead of gitleaks.** The main risk here is personal
  details, which need a private word list that generic secret scanners do not
  have. Broad secret detection is left to the git host's push protection.
- **Findings never print the matched text**, so CI logs on a public repo do
  not repeat the leak or reveal the private word list.

Set up outside the repo (host and editor settings):

- Secret scanning and push protection on the git host.
- Branch protection on `main`: changes arrive by pull request with the
  `check` job passing.
- `LEAKSCAN_TERMS` repository secret.
- Optional agent hook that runs the scanner on each file the agent writes.

## Chunk 4: web view

A localhost page that shows the digest, so output can be read in a browser
instead of the terminal.

| File | Purpose |
|---|---|
| `src/digest.ts` | `buildDigest()` loads the articles and runs the flow. Shared by the CLI and the web view |
| `src/app/api/digest/route.ts` | `GET /api/digest` runs `buildDigest()` and returns the result as JSON |
| `src/app/page.tsx` | The page: sections by topic, score, summary, link, skipped feeds, and a Refresh button |
| `src/app/providers.tsx` | TanStack Query client. A digest stays fresh for 15 minutes |

Decisions made in chunk 4:

- **One package, Next.js at the repo root** with its routes under `src/app`,
  so the page imports the flow code directly. `next build` rewrote parts of
  `tsconfig.json` (JSX, DOM types, its own type folders).
- **Caching is in the browser only**, through TanStack Query. (Chunk 5 changed
  what is cached: the stored run, not a fresh run per request.)
- **No tests for the page.** It only displays what `buildDigest()` returns.

## Chunk 5: scheduled runs, read-only web view

The web view no longer fetches or runs anything on request. It shows the
latest stored run, and runs happen on a schedule.

| File | Purpose |
|---|---|
| `src/store.ts` | `loadRun` / `saveRun` for the latest run in `data/latest-run.json` (gitignored), and `runAndSave` |
| `src/schedule.ts` | Runs the flow at 06:00 local time each day, and once at server start when the last run is more than 24 hours old or missing |
| `src/instrumentation.ts` | Next.js startup hook that starts the schedule |
| `src/app/api/digest/route.ts` | Now read-only: returns the stored run, or `null` before the first run |
| `tests/schedule.test.ts`, `tests/store.test.ts` | Due check, time until 06:00, and a save/load round trip |

Decisions made in chunk 5:

- **The schedule lives inside the web server**, as a timer, with no OS cron
  entry and no new dependency. If the server is not running at 06:00 the run
  is missed, and the check at the next launch catches up.
- **Forcing a run is `npm run digest`.** There is no button or endpoint for
  it; the page cannot trigger a run.
- **One stored run, in a JSON file.** Each run replaces the last. History can
  move to SQLite together with the dedupe step.
- **A run where feeds failed is still stored**, with the failures listed, and
  counts as the run for that day.

## Chunk 6: persistent feed

A run no longer replaces what the web view shows. Items stay in the feed and
each run adds the new ones.

| File | Purpose |
|---|---|
| `src/core/types.ts` | `FeedItem`: a digest item plus its topic and the time it was added |
| `src/store.ts` | Replaces the single stored run with a feed in `data/feed.json`: `loadFeed`, `saveFeed`, and `mergeRun`, which adds a run's items and skips URLs already present |
| `src/app/page.tsx` | One list, newest run first, each item tagged with its topic |

Decisions made in chunk 6:

- **This replaces the "one stored run" decision from chunk 5.** The file
  holds every item delivered so far and the details of the last run.
- **An item is identified by its URL.** A later run that delivers the same
  URL leaves the stored item as it is.
- **Nothing is ever removed.** The feed grows without limit; pruning by age
  is an open item.

## Chunk 7: topic filter

The page has a row of filter buttons, one per topic, with item counts.

- **The topics are not a fixed list.** They are read from the stored items,
  so they are whatever the flow assigned. A new topic from a later run shows
  up as a new button with no code change.
- **Filtering is in the browser**, over the feed already loaded. The choice
  is not saved; a page reload shows everything again.

## Chunk 8: pagination

The page shows 20 items at a time, with Previous and Next buttons and a
"Page 2 of 5" label. The buttons appear only when there is more than one page.

| File | Purpose |
|---|---|
| `src/core/paginate.ts` | `paginate(all, page, pageSize)` returns one page of a list and the page count |
| `tests/paginate.test.ts` | Four tests: a middle page, a short last page, out-of-range page numbers, an empty list |

- **Paging is in the browser**, like the topic filter, over the feed already
  loaded. The endpoint still returns the whole feed.
- **Paging applies after the filter.** Picking a topic goes back to page 1,
  and the page count is for that topic's items.
- **The page number is not saved**; a page reload starts at page 1.

## Chunk 9: model seam

The plan for putting model calls into the workflow is in
`docs/plans/llm-workflow.md`. This chunk is its first step: the function every
model call goes through. Nothing calls it yet, so the digest is unchanged.

| File | Purpose |
|---|---|
| `src/llm/client.ts` | `callModel({ step, schema, system, user })` sends one request to Haiku 5.5 with structured outputs and returns either data matching the zod schema or a reason it failed |
| `tests/llm.test.ts` | Six tests against a fake client: success, refusal, cut-off, schema mismatch, failed request, and one trace line per call |

Decisions made in chunk 9:

- **A failed call is a value, not an exception.** A refusal, a cut-off reply, a
  schema mismatch, or an API error comes back as `{ ok: false, reason }`, so a
  step can skip one article and keep the run going.
- **Every call is traced** to `data/trace.jsonl` (gitignored): time, step,
  model, duration, token counts, outcome. Prompts and replies are not stored.
- **Thinking is off and replies are capped at 1,024 tokens**, since each call
  is one narrow job with a small structured reply.
- **The client is passed in**, with the real one as the default, so tests and
  the later flows can supply a fake.
- **`npm run digest` loads `.env`** through Node's `--env-file-if-exists`, with
  no extra dependency. The web server gets `.env` from Next.js.

## Chunk 10: model scoring

Scoring is now a model call. Summaries are still the first sentence.

| File | Purpose |
|---|---|
| `src/flows/workflow.ts` | `scoreArticle` asks the model for `relevance`, `substance`, a topic and a reason. `createWorkflow(scorer)` builds the flow, so tests pass in their own scorer. `keywordScore` is the old keyword count, used when no API key is set |
| `src/core/types.ts` | Optional `rating` on a digest item (`relevance`, `substance`, `reason`), kept in the stored feed. Optional `skipped` on a digest, for articles whose call failed |
| `src/core/map-limit.ts` | Runs the score calls five at a time |
| `src/core/log.ts` | `log()` prints a timestamped progress line to stderr; silent under the test runner |
| `src/digest.ts` | Reads interests from `interests.json` (gitignored) when it exists, otherwise the samples |
| `interests.example.json` | Template interest list |

Decisions made in chunk 10:

- **Two ratings, one score.** `relevance` is fit to the interests; `substance`
  is how much new, concrete information the article carries, low for
  clickbait. The item's `score` is the lower of the two, so an article has to
  be both on topic and worth reading.
- **Each interest's description carries its own standard**: what is followed,
  what makes a good article, what to skip. The prompt tells the model to judge
  by that when it is given. One call per article, no routing step.
- **The topic is an enum** of the interest topics plus `other`, so the model
  cannot invent one.
- **Ratings are clamped to 1-10 in code**, not constrained in the schema sent
  to the model.
- **A failed call skips that article** and lists it under `skipped`; the run
  completes.
- **The reason is stored with the item** so the web view can show it later.
  That display is a separate change.
- **Every step logs as it happens**: feeds fetched, each article's score and
  topic, how many cleared the threshold, what was saved. The same lines
  appear in the web server console during a scheduled run.

Found on the first live run: with a few hundred articles in the feeds, a run
is a few hundred calls at roughly 2,700 input tokens each, and every run
re-scores all of them because articles below the threshold are not stored.

## Chunk 11: skip articles already scored

A run rates only articles it has not rated before.

| File | Purpose |
|---|---|
| `src/core/dedupe.ts` | `newArticles(articles, seen)` drops URLs scored in an earlier run and repeats inside one fetch |
| `src/store.ts` | `loadSeen` / `saveSeen` for `data/seen.json` (gitignored): each scored URL with the time it was first scored. `runAndSave` takes options, `rescore` among them |
| `src/digest.ts` | `buildDigest(seen)` filters before the flow runs and returns the URLs it scored |

Decisions made in chunk 11:

- **Dedupe is a shared step before the flow**, like fetching, so all three
  flows get the same filtered input.
- **A JSON file, not SQLite.** It does the job with no new dependency. This
  replaces the SQLite plan from the original brief.
- **Rejected articles are remembered too**; that is what stops the daily
  re-scoring. An article whose model call failed is not, so it is retried.
- **The sample articles are never deduped**, so a run without `feeds.json`
  always shows something.
- **`npm run digest -- --rescore`** ignores the file for one run, for use
  after editing `interests.json`. Items already in the stored feed keep their
  old score, since the feed never replaces an existing URL.
- **Only exact URLs match.** Two articles about the same story are both kept;
  grouping them is the next chunk.

## Chunk 12: group articles about the same story

Feeds often carry several articles on one story, sometimes from the same
source under different headlines. They are now collapsed into one item.

| File | Purpose |
|---|---|
| `src/flows/group.ts` | `groupSameStory` is one model call per topic that says which kept articles report the same event. `partition` checks the answer |
| `src/flows/workflow.ts` | The pipeline is now score, gate, group, summarize, compose. `createWorkflow(score, group)` takes the grouper as a second argument |
| `src/core/types.ts` | Optional `related` on a digest item: title, URL and source of each article collapsed into it |

Decisions made in chunk 12:

- **A model call, not title matching.** Two headlines for one story can share
  almost no words, so word overlap misses them.
- **Grouping runs after the threshold gate**, on kept articles only and one
  topic at a time, so it is a handful of calls per run. Every new article is
  still scored once.
- **The best-scored article stands for the story**; the others are stored as
  `related` links and are not summarized.
- **Code checks the model's answer.** Numbers out of range or used twice are
  ignored, and an article the model leaves out stays as its own item. If the
  call fails, every article is kept separately.
- **No grouping without an API key.**
- **Grouping is within one run.** A follow-up in a later run is a new item.

## Chunk 13: tags within a topic

An interest can list tags, finer labels such as a policy area or a level of
government, and each item carries the ones that apply.

- **Tags come from the same score call**, so they cost nothing extra.
- **The model can only pick from the lists in `interests.json`**, and code
  keeps only the tags that belong to the topic it chose.
- **Tags are optional** on both the interest and the item. An item with none
  simply has no `tags` field.
- **The web view does not filter by tag yet**; that is a separate UI change.

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

- The stored feed is never pruned.
- Next in the fetch step: full article text from each URL.
- The real feed list (`feeds.json`) is still to be written.
- Next: summarize with the model, then show the rating, the related links
  and a tag filter on the page.
- Group new articles against stories already in the stored feed.
- `data/seen.json` is never pruned.
