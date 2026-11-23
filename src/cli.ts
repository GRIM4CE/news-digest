import { sampleArticles, sampleInterests } from "./fixtures/sample.ts";
import { workflow } from "./flows/workflow.ts";

const digest = await workflow.run({
  articles: sampleArticles,
  interests: sampleInterests,
  threshold: 5,
});

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
