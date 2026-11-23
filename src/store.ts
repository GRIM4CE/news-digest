import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildDigest, DigestRunSchema, type DigestRun } from "./digest.ts";

/** The latest finished run. The web view reads this and nothing else. */
export const RUN_FILE = "data/latest-run.json";

export async function loadRun(file = RUN_FILE): Promise<DigestRun | undefined> {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch {
    return undefined;
  }
  return DigestRunSchema.parse(JSON.parse(content));
}

export async function saveRun(run: DigestRun, file = RUN_FILE): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  // Write then rename, so a reader never sees a half-written file.
  await writeFile(`${file}.tmp`, JSON.stringify(run, null, 2));
  await rename(`${file}.tmp`, file);
}

/** Run the flow now and store the result, replacing the previous run. */
export async function runAndSave(file = RUN_FILE): Promise<DigestRun> {
  const run = await buildDigest();
  await saveRun(run, file);
  return run;
}
