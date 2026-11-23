import { describe, expect, it } from "vitest";
import { isDue, msUntilHour } from "../src/schedule.ts";

const HOUR_MS = 60 * 60_000;

describe("isDue", () => {
  const now = new Date("2026-01-02T12:00:00Z");

  it("is due when nothing has run", () => {
    expect(isDue(undefined, now)).toBe(true);
  });

  it("is not due within 24 hours of the last run", () => {
    expect(isDue("2026-01-01T12:00:01Z", now)).toBe(false);
  });

  it("is due once the last run is 24 hours old", () => {
    expect(isDue("2026-01-01T12:00:00Z", now)).toBe(true);
  });
});

describe("msUntilHour", () => {
  it("waits until later the same day", () => {
    expect(msUntilHour(6, new Date(2026, 0, 2, 4, 0))).toBe(2 * HOUR_MS);
  });

  it("rolls over to the next day once the hour has passed", () => {
    expect(msUntilHour(6, new Date(2026, 0, 2, 6, 0))).toBe(24 * HOUR_MS);
    expect(msUntilHour(6, new Date(2026, 0, 2, 9, 0))).toBe(21 * HOUR_MS);
  });
});
