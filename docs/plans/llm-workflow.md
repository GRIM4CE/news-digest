# Plan: model calls in the workflow flow

**What we will do:**
- Chunk A, model seam: add `src/llm/client.ts`, one narrow `callModel(step, schema, system, user)` function over `@anthropic-ai/sdk` structured outputs, returning data already validated by a zod schema. It appends every call (step, model, token usage, duration, outcome) to `data/trace.jsonl` (gitignored). The `digest` script loads `.env` with Node's `--env-file-if-exists`.
- Chunk B, score: `scoreArticle` in `src/flows/workflow.ts` calls `claude-haiku-5-5` once per article and returns `{ relevance: 1-10, substance: 1-10, topic, reason }`. `relevance` is fit to the interests; `substance` is how much new, concrete information the article carries (low for clickbait, teasers and rehashes), judged against a short rubric in the prompt. Code sets the item's `score` to the lower of the two, so the threshold and the ordering use both. The two ratings and the reason are stored on the item as an optional `rating`, so the web view can show them later. `topic` is an enum built from the interest topics plus `other`, so the model cannot invent one. Calls run at most 5 at a time.
- Chunk C, summarize: `summarizeArticle` calls the same model for keepers only, 2-3 sentences, told to use only the article text.
- Chunk D, interests: load the interest profile from a gitignored `interests.json` (template `interests.example.json`), the same way `feeds.json` works; samples remain the fallback.
- Failure rule in B and C: an article whose call fails, is refused, or is cut off is skipped and listed in the run, like a failed feed; the run still completes. Tests in `tests/workflow.test.ts` and `tests/llm.test.ts` inject a fake `callModel`; no network.

**Follow-on, after the labelled test set:** reflection on government summaries, topic-based prompt routing, voting on borderline scores, then retrieval of earlier coverage; each is one switchable chunk, measured with and without on the test set.

**Out of scope:** model-written compose, Batch API, prompt caching, full article text, SQLite dedupe, the labelled test set (next plan), agent flows.

**Risks:** rejected articles are not stored, so every run re-scores whatever is still in the feeds until the dedupe chunk lands; cheap on Haiku, but it should be the next chunk.

**What we gain:** real relevance scoring and summaries, a readable trace of every call with its token cost, and a seam the two agent flows can reuse.

**Open questions / assumptions:** assumes Haiku 5.5 for both steps as in the project notes; assumes no API key means the keyword stubs run and the run says so; no project-conventions skill found; live runs are done by the user.

**Rejected alternative:** one call returning score and summary together; fewer calls, but it pays output tokens for articles that get dropped and removes the score-then-gate step this flow exists to show.

**Done when:**
- [ ] `npm run digest` with a key scores and summarizes through the model; without one it falls back to stubs and reports that
- [ ] Every model call appears in `data/trace.jsonl` with token counts
- [ ] A failed or refused call skips that article and is reported, tested with a fake
- [ ] A topic outside the interest list cannot reach the digest
- [ ] `npm run check` passes on each chunk
