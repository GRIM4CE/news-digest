export interface Page<T> {
  items: T[];
  /** The page actually shown, starting at 1. */
  page: number;
  pageCount: number;
}

/** One page of a list. A page number outside the range is moved to the nearest page. */
export function paginate<T>(all: T[], page: number, pageSize: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), page: current, pageCount };
}
