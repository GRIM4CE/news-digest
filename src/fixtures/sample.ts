import type { Article, Interest } from "#/core/types.ts";

export const sampleInterests: Interest[] = [
  { topic: "typescript", description: "TypeScript language and tooling news" },
  { topic: "space", description: "Spaceflight launches and astronomy" },
];

export const sampleArticles: Article[] = [
  {
    url: "https://example.com/ts-release",
    title: "TypeScript ships faster type checking",
    source: "Example Dev Blog",
    text: "The TypeScript team released a new compiler. TypeScript builds are now several times faster on large projects.",
  },
  {
    url: "https://example.com/moon-launch",
    title: "Crewed lunar mission clears final review",
    source: "Example Space News",
    text: "The space agency approved the launch window. Engineers called the space hardware ready after a year of testing.",
  },
  {
    url: "https://example.com/celebrity",
    title: "Celebrity opens a restaurant",
    source: "Example Gossip",
    text: "A well known actor opened a restaurant downtown. Reviews are mixed.",
  },
];
