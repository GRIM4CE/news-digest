import { loadRun, runAndSave } from "./store.ts";

const DAY_MS = 24 * 60 * 60_000;
/** Local time on the machine running the app. */
const RUN_HOUR = 6;

/** A run is due when there has been none, or the last one is over a day old. */
export function isDue(lastRanAt: string | undefined, now: Date): boolean {
  return !lastRanAt || now.getTime() - Date.parse(lastRanAt) >= DAY_MS;
}

/** Milliseconds from `now` until the clock next reads `hour`:00. */
export function msUntilHour(hour: number, now: Date): number {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function runQuietly(why: string): Promise<void> {
  try {
    const run = await runAndSave();
    console.log(`[digest] ${why}: ${run.articleCount} articles in`);
  } catch (error) {
    console.error(`[digest] ${why} failed:`, error);
  }
}

function scheduleNext(): void {
  setTimeout(() => {
    void runQuietly("6am run").then(scheduleNext);
  }, msUntilHour(RUN_HOUR, new Date()));
}

/** Called once when the server starts: catch up if overdue, then run daily. */
export async function startSchedule(): Promise<void> {
  scheduleNext();
  const last = await loadRun().catch(() => undefined);
  if (isDue(last?.ranAt, new Date())) await runQuietly("catch-up run");
}
