/** Next.js calls this once when the server starts. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSchedule } = await import("./schedule.ts");
  // Not awaited: the server should not wait on a run before serving pages.
  void startSchedule();
}
