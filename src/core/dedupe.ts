import type { Article } from "./types.ts";

/** Articles not scored in an earlier run, with repeats inside this list removed. */
export function newArticles(
  articles: Article[],
  seen: ReadonlySet<string>,
): Article[] {
  const taken = new Set(seen);
  return articles.filter(({ url }) => {
    if (taken.has(url)) return false;
    taken.add(url);
    return true;
  });
}
