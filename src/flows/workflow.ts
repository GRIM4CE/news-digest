import type {
  Article,
  Digest,
  DigestItem,
  Flow,
  FlowInput,
  Interest,
} from "#/core/types.ts";

interface Scored {
  article: Article;
  score: number;
  topic: string;
}

/**
 * STUB: counts mentions of each interest's topic word. Replaced by a model
 * call in a later chunk; the signature stays the same.
 */
export async function scoreArticle(
  article: Article,
  interests: Interest[],
): Promise<Scored> {
  const haystack = `${article.title} ${article.text}`.toLowerCase();
  let best = { topic: "other", hits: 0 };
  for (const { topic } of interests) {
    const hits = haystack.split(topic.toLowerCase()).length - 1;
    if (hits > best.hits) best = { topic, hits };
  }
  return { article, topic: best.topic, score: Math.min(10, 1 + best.hits * 3) };
}

/** STUB: first sentence of the article. Replaced by a model call later. */
export async function summarizeArticle(article: Article): Promise<string> {
  return article.text.split(/(?<=\.)\s/)[0] ?? "";
}

/** Groups items by topic, highest score first. Plain code, no model. */
export function composeDigest(
  flow: string,
  entries: { topic: string; item: DigestItem }[],
): Digest {
  const byTopic = new Map<string, DigestItem[]>();
  for (const { topic, item } of entries) {
    byTopic.set(topic, [...(byTopic.get(topic) ?? []), item]);
  }
  const sections = [...byTopic].map(([topic, items]) => ({
    topic,
    items: items.sort((a, b) => b.score - a.score),
  }));
  return { flow, sections };
}

/** Fixed pipeline: score every article, summarize the keepers, compose. */
export const workflow: Flow = {
  name: "workflow",
  async run({ articles, interests, threshold }: FlowInput): Promise<Digest> {
    const scored = await Promise.all(
      articles.map((a) => scoreArticle(a, interests)),
    );
    const keepers = scored.filter((s) => s.score >= threshold);
    const entries = await Promise.all(
      keepers.map(async ({ article, score, topic }) => ({
        topic,
        item: {
          title: article.title,
          url: article.url,
          source: article.source,
          score,
          summary: await summarizeArticle(article),
        },
      })),
    );
    return composeDigest(this.name, entries);
  },
};
