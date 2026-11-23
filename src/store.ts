import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { log } from "./core/log.ts";
import { FeedItemSchema } from "./core/types.ts";
import { buildDigest, DigestRunSchema, type DigestRun } from "./digest.ts";

/** Everything the web view shows: items kept across runs, plus the last run's details. */
export const FeedSchema = z.object({
  lastRun: DigestRunSchema.omit({ digest: true }).extend({ flow: z.string() }).optional(),
  items: z.array(FeedItemSchema),
});
export type Feed = z.infer<typeof FeedSchema>;

export const FEED_FILE = "data/feed.json";
/** URLs scored in earlier runs, each with the time it was first scored. */
export const SEEN_FILE = "data/seen.json";
const SeenSchema = z.record(z.string(), z.iso.datetime());
export type Seen = z.infer<typeof SeenSchema>;

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

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  // Write then rename, so a reader never sees a half-written file.
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${file}.tmp`, file);
}

export const saveFeed = (feed: Feed, file = FEED_FILE) => writeJson(file, feed);

export async function loadSeen(file = SEEN_FILE): Promise<Seen> {
  try {
    return SeenSchema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return {};
  }
}

export const saveSeen = (seen: Seen, file = SEEN_FILE) => writeJson(file, seen);

/**
 * Run the flow now on articles not scored before, add what it delivers to the
 * stored feed, and remember what was scored. `rescore` ignores earlier runs.
 */
export async function runAndSave({
  feedFile = FEED_FILE,
  seenFile = SEEN_FILE,
  rescore = false,
} = {}): Promise<{ run: DigestRun; feed: Feed; added: number }> {
  const seen = await loadSeen(seenFile);
  const { scored, ...run } = await buildDigest(
    new Set(rescore ? [] : Object.keys(seen)),
  );
  const before = await loadFeed(feedFile);
  const feed = mergeRun(before, run);
  await saveFeed(feed, feedFile);
  // Earlier entries win, so a URL keeps the time it was first scored.
  const scoredNow = Object.fromEntries(scored.map((url) => [url, run.ranAt]));
  await saveSeen({ ...scoredNow, ...seen }, seenFile);
  const added = feed.items.length - before.items.length;
  log(`Saved ${feedFile}: ${added} new items, ${feed.items.length} in total`);
  return { run, feed, added };
}
