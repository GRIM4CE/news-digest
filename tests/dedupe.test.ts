import { describe, expect, it } from "vitest";
import { newArticles } from "#/core/dedupe.ts";

const article = (path: string) => ({
  url: `https://example.com/${path}`,
  title: `Title ${path}`,
  source: "Example",
  text: "Text.",
});

describe("newArticles", () => {
  it("drops articles scored in an earlier run", () => {
    const seen = new Set(["https://example.com/a"]);
    const fresh = newArticles([article("a"), article("b")], seen);
    expect(fresh.map((a) => a.url)).toEqual(["https://example.com/b"]);
  });

  it("keeps the first copy when two feeds carry the same URL", () => {
    const fresh = newArticles([article("a"), article("b"), article("a")], new Set());
    expect(fresh.map((a) => a.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("returns nothing when every article has been seen", () => {
    const seen = new Set(["https://example.com/a"]);
    expect(newArticles([article("a")], seen)).toEqual([]);
  });
});
