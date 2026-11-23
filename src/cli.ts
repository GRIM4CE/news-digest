import { buildDigest } from "./digest.ts";

const { digest, articleCount, failures, usedSamples } = await buildDigest();

for (const { feedUrl, reason } of failures) {
  console.error(`Skipped ${feedUrl}: ${reason}`);
}
console.error(
  usedSamples
    ? "No feeds.json found; using sample articles"
    : `Fetched ${articleCount} articles`,
);

console.log(`Digest (${digest.flow})\n`);
for (const { topic, items } of digest.sections) {
  console.log(`## ${topic}`);
  for (const item of items) {
    console.log(`- [${item.score}] ${item.title} (${item.source})`);
    console.log(`  ${item.summary}`);
    console.log(`  ${item.url}`);
  }
  console.log();
}
