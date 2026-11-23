import { buildDigest } from "../../../digest.ts";

/** Runs the flow on every request; the browser caches the result with TanStack Query. */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await buildDigest());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
