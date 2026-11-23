import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Digest } from "./core/types.ts";
import { sampleArticles, sampleInterests } from "./fixtures/sample.ts";
import { workflow } from "./flows/workflow.ts";
import { fetchArticles, type FetchResult } from "./sources/rss.ts";

export interface DigestRun {
  digest: Digest;
  articleCount: number;
  failures: FetchResult["failures"];
  /** True when there is no feeds.json and the sample articles were used. */
  usedSamples: boolean;
}

/** Shared by the CLI and the web app: load articles, run the flow. */
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
  return { digest, articleCount: articles.length, failures, usedSamples };
}
