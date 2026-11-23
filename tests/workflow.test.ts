import { describe, expect, it } from "vitest";
import { DigestSchema } from "#/core/types.ts";
import { sampleArticles, sampleInterests } from "#/fixtures/sample.ts";
import {
  createWorkflow,
  keywordScore,
  scoreArticle,
  type Scorer,
} from "#/flows/workflow.ts";
import type { callModel } from "#/llm/client.ts";

const workflow = createWorkflow(keywordScore);
const article = sampleArticles[0]!;

/** A stand-in for callModel that answers every call with `result`. */
const fakeCall = (result: unknown) =>
  (async () => result) as unknown as typeof callModel;

const input = {
  articles: sampleArticles,
  interests: sampleInterests,
  threshold: 5,
};

describe("workflow (keyword scoring)", () => {
  it("returns a digest that matches the shared schema", async () => {
    const digest = await workflow.run(input);
    expect(() => DigestSchema.parse(digest)).not.toThrow();
    expect(digest.flow).toBe("workflow");
  });

  it("keeps relevant articles and groups them by topic", async () => {
    const digest = await workflow.run(input);
    expect(digest.sections.map((s) => s.topic).sort()).toEqual([
      "space",
      "typescript",
    ]);
  });

  it("drops articles below the threshold", async () => {
    const digest = await workflow.run(input);
    const urls = digest.sections.flatMap((s) => s.items.map((i) => i.url));
    expect(urls).not.toContain("https://example.com/celebrity");
  });

  it("returns no sections when nothing clears the threshold", async () => {
    const digest = await workflow.run({ ...input, threshold: 11 });
    expect(digest.sections).toEqual([]);
  });
});

describe("scoreArticle", () => {
  it("scores an article as the lower of relevance and substance", async () => {
    const reply = { reason: "On topic, thin.", relevance: 9, substance: 3, topic: "space", tags: [] };
    const result = await scoreArticle(
      article,
      sampleInterests,
      fakeCall({ ok: true, data: reply }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        article,
        topic: "space",
        score: 3,
        rating: { relevance: 9, substance: 3, reason: "On topic, thin." },
      },
    });
  });

  it("keeps ratings inside 1 to 10", async () => {
    const reply = { reason: "r", relevance: 14, substance: 0, topic: "other", tags: [] };
    const result = await scoreArticle(
      article,
      sampleInterests,
      fakeCall({ ok: true, data: reply }),
    );
    expect(result.ok && result.data.rating).toMatchObject({ relevance: 10, substance: 1 });
  });

  it("limits the topic to the interest topics and other", async () => {
    let topics: unknown;
    const call = (async ({ schema }: { schema: { shape: { topic: { options: unknown } } } }) => {
      topics = schema.shape.topic.options;
      return { ok: false, reason: "unused" };
    }) as unknown as typeof callModel;
    await scoreArticle(article, sampleInterests, call);
    expect(topics).toEqual(["typescript", "space", "other"]);
  });
});

describe("scoreArticle tags", () => {
  const interests = [
    { topic: "space", description: "Spaceflight.", tags: ["launch", "science"] },
    { topic: "typescript", description: "TypeScript.", tags: ["release"] },
  ];
  const reply = (tags: string[]) =>
    fakeCall({
      ok: true,
      data: { reason: "r", relevance: 8, substance: 8, topic: "space", tags },
    });

  it("keeps only tags that belong to the chosen topic", async () => {
    const result = await scoreArticle(article, interests, reply(["release", "science"]));
    expect(result.ok && result.data.tags).toEqual(["science"]);
  });

  it("leaves tags off when none apply", async () => {
    const result = await scoreArticle(article, interests, reply([]));
    expect(result.ok && "tags" in result.data).toBe(false);
  });

  it("offers the model every interest's tags and no others", async () => {
    let options: unknown;
    const call = (async ({
      schema,
    }: {
      schema: { shape: { tags: { element: { options: unknown } } } };
    }) => {
      options = schema.shape.tags.element.options;
      return { ok: false, reason: "unused" };
    }) as unknown as typeof callModel;
    await scoreArticle(article, interests, call);
    expect(options).toEqual(["launch", "science", "release"]);
  });
});

describe("workflow with a failing scorer", () => {
  it("skips the article, reports it, and keeps the rest with their rating", async () => {
    const rating = { relevance: 8, substance: 7, reason: "Solid." };
    const scorer: Scorer = async (a) =>
      a.url === article.url
        ? { ok: false, reason: "refused" }
        : { ok: true, data: { article: a, topic: "space", score: 7, rating } };
    const digest = await createWorkflow(scorer).run(input);
    expect(digest.skipped).toEqual([{ url: article.url, reason: "refused" }]);
    expect(digest.sections[0]?.items).toHaveLength(2);
    expect(digest.sections[0]?.items[0]?.rating).toEqual(rating);
    expect(() => DigestSchema.parse(digest)).not.toThrow();
  });
});
