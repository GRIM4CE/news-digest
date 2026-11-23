import { describe, expect, it } from "vitest";
import { fetchArticles, htmlToText, parseArticles } from "../src/sources/rss.ts";

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example Dev Blog</title>
    <item>
      <title>First post</title>
      <link>https://example.com/first</link>
      <description>Short snippet</description>
      <content:encoded><![CDATA[<p>Full <b>text</b> &amp; more</p>]]></content:encoded>
    </item>
    <item><title>No link</title></item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom post</title>
    <link rel="self" href="https://example.org/self"/>
    <link rel="alternate" href="https://example.org/post"/>
    <summary>Atom summary</summary>
  </entry>
</feed>`;

const respond = (pages: Record<string, string>) =>
  (async (url: string | URL | Request) => {
    const body = pages[String(url)];
    return body === undefined
      ? new Response("missing", { status: 404 })
      : new Response(body);
  }) as typeof fetch;

describe("htmlToText", () => {
  it("strips tags, decodes entities, and collapses whitespace", () => {
    expect(htmlToText("<p>One &amp;\n two</p><p>three</p>")).toBe(
      "One & two three",
    );
  });
});

describe("parseArticles", () => {
  it("maps RSS items, prefers full content, and drops items without a link", () => {
    expect(parseArticles(rss, "https://example.com/feed")).toEqual([
      {
        url: "https://example.com/first",
        title: "First post",
        source: "Example Dev Blog",
        text: "Full text & more",
      },
    ]);
  });

  it("maps Atom entries and falls back to the hostname as source", () => {
    expect(parseArticles(atom, "https://example.org/atom.xml")).toEqual([
      {
        url: "https://example.org/post",
        title: "Atom post",
        source: "example.org",
        text: "Atom summary",
      },
    ]);
  });
});

describe("fetchArticles", () => {
  it("collects articles and reports failed feeds without stopping", async () => {
    const result = await fetchArticles(
      [
        "https://example.com/feed",
        "https://example.com/gone",
        "https://example.com/junk",
      ],
      respond({
        "https://example.com/feed": rss,
        "https://example.com/junk": "not a feed",
      }),
    );
    expect(result.articles.map((a) => a.title)).toEqual(["First post"]);
    expect(result.failures).toEqual([
      { feedUrl: "https://example.com/gone", reason: "HTTP 404" },
      { feedUrl: "https://example.com/junk", reason: "Unrecognized feed format" },
    ]);
  });
});
