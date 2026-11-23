import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { FeedItemSchema } from "./core/types.ts";
import { buildDigest, DigestRunSchema, type DigestRun } from "./digest.ts";

/** Everything the web view shows: items kept across runs, plus the last run's details. */
export const FeedSchema = z.object({
  lastRun: DigestRunSchema.omit({ digest: true }).extend({ flow: z.string() }).optional(),
  items: z.array(FeedItemSchema),
});
export type Feed = z.infer<typeof FeedSchema>;

export const FEED_FILE = "data/feed.json";

/** Add a run's items to the feed. Items already there (same URL) are kept as they are. */
export function mergeRun(feed: Feed, run: DigestRun): Feed {
  const { digest, ...details } = run;
  const known = new Set(feed.items.map((item) => item.url));
  const added = digest.sections.flatMap(({ topic, items }) =>
    items
      .filter((item) => !known.has(item.url))
      .map((item) => ({ ...item, topic, addedAt: run.ranAt })),
  );
  return {
    lastRun: { ...details, flow: digest.flow },
    // Newest run first; within a run, highest score first.
    items: [...added.sort((a, b) => b.score - a.score), ...feed.items],
  };
}

export async function loadFeed(file = FEED_FILE): Promise<Feed> {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch {
    return { items: [] };
  }
  return FeedSchema.parse(JSON.parse(content));
}

export async function saveFeed(feed: Feed, file = FEED_FILE): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  // Write then rename, so a reader never sees a half-written file.
  await writeFile(`${file}.tmp`, JSON.stringify(feed, null, 2));
  await rename(`${file}.tmp`, file);
}

/** Run the flow now and add what it delivers to the stored feed. */
export async function runAndSave(
  file = FEED_FILE,
): Promise<{ run: DigestRun; feed: Feed; added: number }> {
  const run = await buildDigest();
  const before = await loadFeed(file);
  const feed = mergeRun(before, run);
  await saveFeed(feed, file);
  return { run, feed, added: feed.items.length - before.items.length };
}
