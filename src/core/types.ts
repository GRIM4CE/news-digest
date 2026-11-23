import { z } from "zod";

/** An article after fetching and text extraction, before any model sees it. */
export const ArticleSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
  source: z.string().min(1),
  text: z.string(),
});
export type Article = z.infer<typeof ArticleSchema>;

/** One thing the reader cares about. The description is what the model scores against. */
export const InterestSchema = z.object({
  topic: z.string().min(1),
  description: z.string().min(1),
  /** Finer labels an article in this topic may carry, e.g. a policy area. */
  tags: z.array(z.string().min(1)).optional(),
});
export type Interest = z.infer<typeof InterestSchema>;

const OneToTen = z.number().int().min(1).max(10);

/** Why an item got its score. Kept with the item so it can be shown later. */
export const RatingSchema = z.object({
  /** How well the article fits the reader's interests. */
  relevance: OneToTen,
  /** How much new, concrete information it carries; low for clickbait. */
  substance: OneToTen,
  reason: z.string(),
});
export type Rating = z.infer<typeof RatingSchema>;

export const DigestItemSchema = z.object({
  title: z.string(),
  url: z.url(),
  source: z.string(),
  /** The lower of relevance and substance when a rating is present. */
  score: OneToTen,
  summary: z.string(),
  /** Missing on items scored without the model, and on older stored items. */
  rating: RatingSchema.optional(),
  /** Labels from the topic's own tag list, for filtering within the topic. */
  tags: z.array(z.string()).optional(),
  /** Other articles about the same story, collapsed into this item. */
  related: z
    .array(z.object({ title: z.string(), url: z.url(), source: z.string() }))
    .optional(),
});
export type DigestItem = z.infer<typeof DigestItemSchema>;

export const DigestSchema = z.object({
  flow: z.string(),
  sections: z.array(
    z.object({ topic: z.string(), items: z.array(DigestItemSchema) }),
  ),
  /** Articles left out because their model call failed. */
  skipped: z.array(z.object({ url: z.string(), reason: z.string() })).optional(),
});
export type Digest = z.infer<typeof DigestSchema>;

export interface FlowInput {
  articles: Article[];
  interests: Interest[];
  /** Articles scoring below this are left out of the digest. */
  threshold: number;
}

/**
 * The contract all three implementations share (workflow, single agent,
 * multi-agent), so they can run on the same input and be compared.
 */
export interface Flow {
  name: string;
  run(input: FlowInput): Promise<Digest>;
}

/** A digest item once it is in the stored feed, where it stays across runs. */
export const FeedItemSchema = DigestItemSchema.extend({
  topic: z.string(),
  /** When the run that first delivered this item finished. */
  addedAt: z.iso.datetime(),
});
export type FeedItem = z.infer<typeof FeedItemSchema>;
