import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { callModel, MODEL, type ModelDeps } from "#/llm/client.ts";

const schema = z.object({ score: z.number() });
const request = { step: "score", schema, system: "Score it.", user: "An article." };

/** Deps whose client answers every call with `reply`, or throws it. */
async function depsReplying(reply: object | Error): Promise<ModelDeps> {
  const dir = await mkdtemp(join(tmpdir(), "llm-"));
  const parse = async () => {
    if (reply instanceof Error) throw reply;
    return { usage: { input_tokens: 40, output_tokens: 8 }, ...reply };
  };
  return {
    client: { messages: { parse } } as unknown as Anthropic,
    traceFile: join(dir, "nested", "trace.jsonl"),
  };
}

async function traceLines(deps: ModelDeps): Promise<Record<string, unknown>[]> {
  const text = await readFile(deps.traceFile, "utf8");
  return text.trim().split("\n").map((line) => JSON.parse(line));
}

describe("callModel", () => {
  it("returns the parsed reply and traces the call with token counts", async () => {
    const deps = await depsReplying({
      stop_reason: "end_turn",
      parsed_output: { score: 7 },
    });
    expect(await callModel(request, deps)).toEqual({ ok: true, data: { score: 7 } });
    expect(await traceLines(deps)).toMatchObject([
      { step: "score", model: MODEL, inputTokens: 40, outputTokens: 8, outcome: "ok" },
    ]);
  });

  it.each([
    ["a refusal", { stop_reason: "refusal", parsed_output: null }, "refused"],
    [
      "a reply cut off by the token limit",
      { stop_reason: "max_tokens", parsed_output: null },
      "cut off at max_tokens",
    ],
    [
      "a reply that does not match the schema",
      { stop_reason: "end_turn", parsed_output: null },
      "reply did not match the schema",
    ],
    ["a failed request", new Error("network down"), "network down"],
  ])("reports %s as a failure instead of throwing", async (_name, reply, reason) => {
    const deps = await depsReplying(reply);
    expect(await callModel(request, deps)).toEqual({ ok: false, reason });
    expect(await traceLines(deps)).toMatchObject([{ step: "score", outcome: reason }]);
  });

  it("appends one trace line per call", async () => {
    const deps = await depsReplying({ stop_reason: "end_turn", parsed_output: { score: 1 } });
    await callModel(request, deps);
    await callModel(request, deps);
    expect(await traceLines(deps)).toHaveLength(2);
  });
});
