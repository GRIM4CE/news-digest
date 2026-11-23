import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { newArticles } from "./core/dedupe.ts";
import { log } from "./core/log.ts";
import { DigestSchema, InterestSchema } from "./core/types.ts";
import { sampleArticles, sampleInterests } from "./fixtures/sample.ts";
import { workflow } from "./flows/workflow.ts";
import { hasModelKey, MODEL } from "./llm/client.ts";
import { fetchArticles, type FetchResult } from "./sources/rss.ts";

/** One finished run: what the flow produced, and what went in. */
export const DigestRunSchema = z.object({
  ranAt: z.iso.datetime(),
  digest: DigestSchema,
  /** Articles the feeds returned, before earlier-scored ones were dropped. */
  articleCount: z.number().int(),
  /** Articles that went to the flow. Missing on runs stored before dedupe. */
  newCount: z.number().int().optional(),
  failures: z.array(z.object({ feedUrl: z.string(), reason: z.string() })),
  /** True when there is no feeds.json and the sample articles were used. */
  usedSamples: z.boolean(),
});
export type DigestRun = z.infer<typeof DigestRunSchema>;

/**
 * Fetch the articles, drop the ones in `seen`, and run the flow on the rest.
 * Does not store anything. `scored` lists the URLs the flow got through, for
 * the caller to remember; an article whose model call failed is left out, so
 * the next run tries it again.
 */
export async function buildDigest(
  seen: ReadonlySet<string> = new Set(),
): Promise<DigestRun & { scored: string[] }> {
  const usedSamples = !existsSync("feeds.json");
  let articles = sampleArticles;
  let failures: FetchResult["failures"] = [];
  if (!usedSamples) {
    const feedUrls = z
      .array(z.url())
      .parse(JSON.parse(await readFile("feeds.json", "utf8")));
    log(`Fetching ${feedUrls.length} feeds`);
    ({ articles, failures } = await fetchArticles(feedUrls));
  } else {
    log("No feeds.json found; using the sample articles");
  }
  let interests = sampleInterests;
  if (existsSync("interests.json")) {
    interests = z
      .array(InterestSchema)
      .min(1)
      .parse(JSON.parse(await readFile("interests.json", "utf8")));
  } else {
    log("No interests.json found; scoring against the sample interests");
  }
  log(`Interests: ${interests.map((i) => i.topic).join(", ")}`);
  log(
    hasModelKey()
      ? `Scoring with ${MODEL}`
      : "No ANTHROPIC_API_KEY set; scoring by keyword count",
  );
  // The samples are always scored, so a demo run is never empty.
  const fresh = usedSamples ? articles : newArticles(articles, seen);
  log(`${fresh.length} of ${articles.length} articles are new`);
  const digest = await workflow.run({
    articles: fresh,
    interests,
    threshold: 5,
  });
  const failed = new Set(digest.skipped?.map((s) => s.url));
  return {
    ranAt: new Date().toISOString(),
    digest,
    articleCount: articles.length,
    newCount: fresh.length,
    scored: fresh.map((a) => a.url).filter((url) => !failed.has(url)),
    failures,
    usedSamples,
  };
}
