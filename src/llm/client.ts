import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODEL = "claude-haiku-5-5";
export const TRACE_FILE = "data/trace.jsonl";

/** False when no API key is set, in which case steps fall back to plain code. */
export const hasModelKey = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

export interface ModelRequest<S extends z.ZodType> {
  /** Which pipeline step is calling, e.g. "score". Used in the trace. */
  step: string;
  /** Shape the reply must have. The model is constrained to it. */
  schema: S;
  system: string;
  user: string;
}

/** A call either yields data matching the schema or a reason it did not. */
export type ModelResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export interface ModelDeps {
  client: Anthropic;
  traceFile: string;
}

let defaults: ModelDeps | undefined;
const defaultDeps = (): ModelDeps =>
  (defaults ??= { client: new Anthropic(), traceFile: TRACE_FILE });

function failureReason(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `api error ${error.status ?? "unknown"}: ${error.message}`;
  }
  return error instanceof Error ? error.message : "request failed";
}

/**
 * The one place a model is called. Sends a single request, returns the reply
 * validated against the schema, and appends one line to the trace file.
 * Never throws for a failed call: the caller decides what a failure means.
 */
export async function callModel<S extends z.ZodType>(
  { step, schema, system, user }: ModelRequest<S>,
  deps: ModelDeps = defaultDeps(),
): Promise<ModelResult<z.infer<S>>> {
  const started = Date.now();
  let result: ModelResult<z.infer<S>>;
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  try {
    const message = await deps.client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema) },
    });
    usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
    if (message.stop_reason === "refusal") {
      result = { ok: false, reason: "refused" };
    } else if (message.stop_reason === "max_tokens") {
      result = { ok: false, reason: "cut off at max_tokens" };
    } else if (message.parsed_output === null) {
      result = { ok: false, reason: "reply did not match the schema" };
    } else {
      result = { ok: true, data: message.parsed_output };
    }
  } catch (error) {
    result = { ok: false, reason: failureReason(error) };
  }

  await mkdir(dirname(deps.traceFile), { recursive: true });
  await appendFile(
    deps.traceFile,
    JSON.stringify({
      at: new Date(started).toISOString(),
      step,
      model: MODEL,
      ms: Date.now() - started,
      ...usage,
      outcome: result.ok ? "ok" : result.reason,
    }) + "\n",
  );
  return result;
}
