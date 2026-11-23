import { describe, expect, it } from "vitest";
import { fetchArticles, firstImage, htmlToText, parseArticles } from "#/sources/rss.ts";

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

describe("article images", () => {
  const feed = (item: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel><title>Example</title>
    <item><title>Post</title><link>https://example.com/post</link>${item}</item>
  </channel>
</rss>`;
  const imageOf = (item: string) =>
    parseArticles(feed(item), "https://example.com/feed")[0]?.imageUrl;

  it("takes a Media RSS thumbnail", () => {
    expect(imageOf('<media:thumbnail url="https://example.com/thumb.jpg"/>')).toBe(
      "https://example.com/thumb.jpg",
    );
  });

  it("takes an image enclosure but not an audio one", () => {
    expect(
      imageOf('<enclosure url="https://example.com/pic.png" type="image/png" length="1"/>'),
    ).toBe("https://example.com/pic.png");
    expect(
      imageOf('<enclosure url="https://example.com/show.mp3" type="audio/mpeg" length="1"/>'),
    ).toBeUndefined();
  });

  it("falls back to the first picture in the body", () => {
    const body = '<description><![CDATA[<p>Hi</p><img alt="x" src="https://example.com/a.jpg?w=1&amp;h=2">]]></description>';
    expect(imageOf(body)).toBe("https://example.com/a.jpg?w=1&h=2");
  });

  it("keeps the article when the image address is not a web address", () => {
    const article = parseArticles(
      feed('<description><![CDATA[<img src="/relative.jpg">]]></description>'),
      "https://example.com/feed",
    )[0];
    expect(article?.url).toBe("https://example.com/post");
    expect(article?.imageUrl).toBeUndefined();
  });

  it("finds no image in plain text", () => {
    expect(firstImage("<p>No pictures here</p>")).toBeUndefined();
  });
});
