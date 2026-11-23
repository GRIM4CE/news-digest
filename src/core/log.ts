/** One progress line on stderr, with the time. Silent under the test runner. */
export function log(message: string): void {
  if (process.env.VITEST) return;
  console.error(`[${new Date().toLocaleTimeString()}] ${message}`);
}
