import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DigestRun } from "../src/digest.ts";
import { loadRun, saveRun } from "../src/store.ts";

const run: DigestRun = {
  ranAt: "2026-01-02T06:00:00.000Z",
  digest: { flow: "workflow", sections: [] },
  articleCount: 0,
  failures: [],
  usedSamples: true,
};

describe("run store", () => {
  it("returns undefined when nothing has been stored", async () => {
    const dir = await mkdtemp(join(tmpdir(), "store-"));
    expect(await loadRun(join(dir, "missing.json"))).toBeUndefined();
  });

  it("reads back the run it saved", async () => {
    const dir = await mkdtemp(join(tmpdir(), "store-"));
    const file = join(dir, "nested", "run.json");
    await saveRun(run, file);
    expect(await loadRun(file)).toEqual(run);
  });
});
