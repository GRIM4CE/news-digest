import { parseFeed } from "feedsmith";
import { ArticleSchema, type Article } from "#/core/types.ts";

interface RawItem {
  title?: string;
  url?: string;
  html?: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Feed bodies are HTML snippets; the model only needs the words. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

/** Flatten the per-format shapes (RSS, Atom, RDF, JSON Feed) into one. */
function readFeed(content: string): { title?: string; items: RawItem[] } {
  const parsed = parseFeed(content);
  switch (parsed.format) {
    case "rss":
    case "rdf":
      return {
        title: parsed.feed.title,
        items: (parsed.feed.items ?? []).map((item) => ({
          title: item.title,
          url: item.link,
          html: item.content?.encoded ?? item.description,
        })),
      };
    case "atom":
      return {
        title: parsed.feed.title?.value,
        items: (parsed.feed.entries ?? []).map((entry) => ({
          title: entry.title?.value,
          url: (
            entry.links?.find((link) => link.rel === "alternate") ??
            entry.links?.[0]
          )?.href,
          html: entry.content?.value ?? entry.summary?.value,
        })),
      };
    case "json":
      return {
        title: parsed.feed.title,
        items: (parsed.feed.items ?? []).map((item) => ({
          title: item.title,
          url: item.url,
          html: item.content_html ?? item.content_text ?? item.summary,
        })),
      };
  }
}

/** Turn one feed document into articles. Items without a title or link are dropped. */
export function parseArticles(content: string, feedUrl: string): Article[] {
  const { title, items } = readFeed(content);
  const source = title?.trim() || new URL(feedUrl).hostname;
  return items.flatMap((item) => {
    const article = ArticleSchema.safeParse({
      url: item.url,
      title: item.title?.trim(),
      source,
      text: htmlToText(item.html ?? ""),
    });
    return article.success ? [article.data] : [];
  });
}

export interface FetchResult {
  articles: Article[];
  /** Feeds that could not be fetched or parsed. One bad feed does not stop the rest. */
  failures: { feedUrl: string; reason: string }[];
}

export async function fetchArticles(
  feedUrls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  const results = await Promise.allSettled(
    feedUrls.map(async (feedUrl) => {
      const response = await fetchImpl(feedUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseArticles(await response.text(), feedUrl);
    }),
  );

  const result: FetchResult = { articles: [], failures: [] };
  results.forEach((settled, index) => {
    if (settled.status === "fulfilled") {
      result.articles.push(...settled.value);
    } else {
      // Node's fetch reports "fetch failed" and keeps the real reason in `cause`.
      const error: unknown = settled.reason;
      const cause = error instanceof Error ? error.cause : undefined;
      const reason =
        cause instanceof Error
          ? cause.message
          : error instanceof Error
            ? error.message
            : String(error);
      result.failures.push({ feedUrl: feedUrls[index] ?? "", reason });
    }
  });
  return result;
}
