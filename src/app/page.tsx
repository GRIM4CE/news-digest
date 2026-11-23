"use client";

import { useQuery } from "@tanstack/react-query";
import type { Feed } from "../store.ts";

/** Reads the stored feed. The page never starts a run. */
async function fetchFeed(): Promise<Feed> {
  const response = await fetch("/api/digest");
  const body = (await response.json()) as Feed & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body;
}

export default function Page() {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["feed"],
    queryFn: fetchFeed,
  });
  const lastRun = data?.lastRun;

  return (
    <main>
      <header>
        <h1>News digest</h1>
        <button onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Loading…" : "Reload"}
        </button>
      </header>

      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">Could not load the feed: {error.message}</p>}

      {data && !lastRun && (
        <p className="muted">
          No run has finished yet. One starts when the app launches; reload in a moment.
        </p>
      )}

      {lastRun && (
        <>
          <p className="muted">
            {data.items.length} items · last run {new Date(lastRun.ranAt).toLocaleString()} (
            {lastRun.flow}, {lastRun.articleCount} articles in,{" "}
            {lastRun.usedSamples ? "sample articles" : "live feeds"})
          </p>
          {lastRun.failures.map(({ feedUrl, reason }) => (
            <p key={feedUrl} className="error">
              Skipped {feedUrl}: {reason}
            </p>
          ))}
        </>
      )}

      {data?.items.map((item) => (
        <article key={item.url}>
          <span className="score">{item.score}</span>
          <div>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
            <p>{item.summary}</p>
            <p className="muted">
              {item.topic} · {item.source} · {new Date(item.addedAt).toLocaleDateString()}
            </p>
          </div>
        </article>
      ))}
    </main>
  );
}
