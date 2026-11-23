import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Article } from "./core/types.ts";
import { sampleArticles, sampleInterests } from "./fixtures/sample.ts";
import { workflow } from "./flows/workflow.ts";
import { fetchArticles } from "./sources/rss.ts";

/** Real feeds come from a gitignored feeds.json; without it the samples are used. */
async function loadArticles(): Promise<Article[]> {
  if (!existsSync("feeds.json")) return sampleArticles;
  const feedUrls = z.array(z.url()).parse(
    JSON.parse(await readFile("feeds.json", "utf8")),
  );
  const { articles, failures } = await fetchArticles(feedUrls);
  for (const { feedUrl, reason } of failures) {
    console.error(`Skipped ${feedUrl}: ${reason}`);
  }
  console.error(`Fetched ${articles.length} articles from ${feedUrls.length} feeds`);
  return articles;
}

const digest = await workflow.run({
  articles: await loadArticles(),
  interests: sampleInterests,
  threshold: 5,
});

console.log(`Digest (${digest.flow})\n`);
for (const { topic, items } of digest.sections) {
  console.log(`## ${topic}`);
  for (const item of items) {
    console.log(`- [${item.score}] ${item.title} (${item.source})`);
    console.log(`  ${item.summary}`);
    console.log(`  ${item.url}`);
  }
  console.log();
}
