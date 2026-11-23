import { describe, expect, it } from "vitest";
import { paginate } from "#/core/paginate.ts";

const five = [1, 2, 3, 4, 5];

describe("paginate", () => {
  it("returns the requested page", () => {
    expect(paginate(five, 2, 2)).toEqual({ items: [3, 4], page: 2, pageCount: 3 });
  });

  it("returns a short last page", () => {
    expect(paginate(five, 3, 2)).toEqual({ items: [5], page: 3, pageCount: 3 });
  });

  it("moves a page number outside the range to the nearest page", () => {
    expect(paginate(five, 9, 2).page).toBe(3);
    expect(paginate(five, 0, 2).page).toBe(1);
  });

  it("gives one empty page for an empty list", () => {
    expect(paginate([], 1, 2)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});
