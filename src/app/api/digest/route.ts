import { loadFeed } from "#/store.ts";

/** Read-only: returns the stored feed. Runs happen on the schedule or from the CLI. */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await loadFeed());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
