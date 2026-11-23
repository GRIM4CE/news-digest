import { describe, expect, it } from "vitest";
import { DigestSchema } from "../src/core/types.ts";
import { sampleArticles, sampleInterests } from "../src/fixtures/sample.ts";
import { workflow } from "../src/flows/workflow.ts";

const input = {
  articles: sampleArticles,
  interests: sampleInterests,
  threshold: 5,
};

describe("workflow (stubbed)", () => {
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
