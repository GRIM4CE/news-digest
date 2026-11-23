import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { DigestSchema } from "./core/types.ts";
import { sampleArticles, sampleInterests } from "./fixtures/sample.ts";
import { workflow } from "./flows/workflow.ts";
import { fetchArticles, type FetchResult } from "./sources/rss.ts";

/** One finished run: what the flow produced, and what went in. */
export const DigestRunSchema = z.object({
  ranAt: z.iso.datetime(),
  digest: DigestSchema,
  articleCount: z.number().int(),
  failures: z.array(z.object({ feedUrl: z.string(), reason: z.string() })),
  /** True when there is no feeds.json and the sample articles were used. */
  usedSamples: z.boolean(),
});
export type DigestRun = z.infer<typeof DigestRunSchema>;

/** Fetch the articles and run the flow. Does not store anything. */
export async function buildDigest(): Promise<DigestRun> {
  const usedSamples = !existsSync("feeds.json");
  let articles = sampleArticles;
  let failures: FetchResult["failures"] = [];
  if (!usedSamples) {
    const feedUrls = z
      .array(z.url())
      .parse(JSON.parse(await readFile("feeds.json", "utf8")));
    ({ articles, failures } = await fetchArticles(feedUrls));
  }
  const digest = await workflow.run({
    articles,
    interests: sampleInterests,
    threshold: 5,
  });
  return {
    ranAt: new Date().toISOString(),
    digest,
    articleCount: articles.length,
    failures,
    usedSamples,
  };
}
