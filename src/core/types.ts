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
});
export type Interest = z.infer<typeof InterestSchema>;

export const DigestItemSchema = z.object({
  title: z.string(),
  url: z.url(),
  source: z.string(),
  score: z.number().int().min(1).max(10),
  summary: z.string(),
});
export type DigestItem = z.infer<typeof DigestItemSchema>;

export const DigestSchema = z.object({
  flow: z.string(),
  sections: z.array(
    z.object({ topic: z.string(), items: z.array(DigestItemSchema) }),
  ),
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
