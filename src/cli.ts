import { runAndSave } from "./store.ts";

/** Forces a run now, whatever the schedule says, and adds the result to the stored feed. */
const { run } = await runAndSave({ rescore: process.argv.includes("--rescore") });
const { digest } = run;

for (const { url, reason } of digest.skipped ?? []) {
  console.error(`Skipped ${url}: ${reason}`);
}

console.log(`Digest (${digest.flow})\n`);
for (const { topic, items } of digest.sections) {
  console.log(`## ${topic}`);
  for (const item of items) {
    console.log(`- [${item.score}] ${item.title} (${item.source})`);
    console.log(`  ${item.summary}`);
    if (item.rating) {
      const { relevance, substance, reason } = item.rating;
      console.log(`  relevance ${relevance}, substance ${substance}: ${reason}`);
    }
    console.log(`  ${item.url}`);
  }
  console.log();
}
