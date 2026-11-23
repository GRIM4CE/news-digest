import { FEED_FILE, runAndSave } from "./store.ts";

/** Forces a run now, whatever the schedule says, and adds the result to the stored feed. */
const { run, feed, added } = await runAndSave();
const { digest, articleCount, failures, usedSamples } = run;

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
console.error(`Added ${added} new items to ${FEED_FILE} (${feed.items.length} in total)`);
