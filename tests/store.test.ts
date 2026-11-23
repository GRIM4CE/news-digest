import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DigestRun } from "#/digest.ts";
import { loadFeed, mergeRun, saveFeed } from "#/store.ts";

function runWith(ranAt: string, urls: string[]): DigestRun {
  return {
    ranAt,
    digest: {
      flow: "workflow",
      sections: [
        {
          topic: "space",
          items: urls.map((url) => ({
            title: `Title for ${url}`,
            url,
            source: "Example",
            score: 7,
            summary: "A summary.",
          })),
        },
      ],
    },
    articleCount: urls.length,
    failures: [],
    usedSamples: true,
  };
}

const first = runWith("2026-01-02T06:00:00.000Z", ["https://example.com/a"]);
const second = runWith("2026-01-03T06:00:00.000Z", [
  "https://example.com/a",
  "https://example.com/b",
]);

describe("mergeRun", () => {
  it("keeps earlier items and adds only new ones, newest first", () => {
    const feed = mergeRun(mergeRun({ items: [] }, first), second);
    expect(feed.items.map((item) => item.url)).toEqual([
      "https://example.com/b",
      "https://example.com/a",
    ]);
    expect(feed.items[1]?.addedAt).toBe(first.ranAt);
    expect(feed.items[0]?.topic).toBe("space");
    expect(feed.lastRun?.ranAt).toBe(second.ranAt);
  });

  it("keeps the feed when a run delivers nothing", () => {
    const feed = mergeRun(mergeRun({ items: [] }, first), runWith(second.ranAt, []));
    expect(feed.items).toHaveLength(1);
  });
});

describe("feed store", () => {
  it("returns an empty feed when nothing has been stored", async () => {
    const dir = await mkdtemp(join(tmpdir(), "store-"));
    expect(await loadFeed(join(dir, "missing.json"))).toEqual({ items: [] });
  });

  it("reads back the feed it saved", async () => {
    const dir = await mkdtemp(join(tmpdir(), "store-"));
    const file = join(dir, "nested", "feed.json");
    const feed = mergeRun({ items: [] }, first);
    await saveFeed(feed, file);
    expect(await loadFeed(file)).toEqual(feed);
  });
});
