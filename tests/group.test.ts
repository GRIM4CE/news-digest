import { describe, expect, it } from "vitest";
import { sampleArticles, sampleInterests } from "#/fixtures/sample.ts";
import { groupSameStory, partition } from "#/flows/group.ts";
import { createWorkflow, type Scored, type Scorer } from "#/flows/workflow.ts";
import type { callModel } from "#/llm/client.ts";

const fakeCall = (result: unknown) =>
  (async () => result) as unknown as typeof callModel;

const items: Scored[] = sampleArticles.map((article, i) => ({
  article,
  topic: "space",
  score: 5 + i,
}));

describe("partition", () => {
  it("keeps the model's groups and puts everything else on its own", () => {
    expect(partition(4, [[1, 3]])).toEqual([[0, 2], [1], [3]]);
  });

  it("ignores numbers out of range, repeats, and reuse across groups", () => {
    expect(partition(3, [[1, 1, 9, 2], [2, 3], [0]])).toEqual([[0, 1], [2]]);
  });
});

describe("groupSameStory", () => {
  it("returns the articles the model put together as one story", async () => {
    const call = fakeCall({ ok: true, data: { groups: [[1, 2]] } });
    const stories = await groupSameStory(items, call);
    expect(stories.map((s) => s.map((i) => i.article.url))).toEqual([
      [items[0]!.article.url, items[1]!.article.url],
      [items[2]!.article.url],
    ]);
  });

  it("keeps every article separate when the call fails", async () => {
    const stories = await groupSameStory(items, fakeCall({ ok: false, reason: "refused" }));
    expect(stories).toHaveLength(3);
  });
});

describe("workflow with grouping", () => {
  it("collapses a story into its best-scored article with the rest as links", async () => {
    const scorer: Scorer = async (article) => ({
      ok: true,
      data: items.find((i) => i.article === article)!,
    });
    const flow = createWorkflow(scorer, async (all) => [all]);
    const digest = await flow.run({
      articles: sampleArticles,
      interests: sampleInterests,
      threshold: 5,
    });
    const [item, ...others] = digest.sections.flatMap((s) => s.items);
    expect(others).toEqual([]);
    expect(item?.url).toBe(items[2]!.article.url);
    expect(item?.related?.map((r) => r.url)).toEqual([
      items[1]!.article.url,
      items[0]!.article.url,
    ]);
  });
});
