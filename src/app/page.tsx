"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  const [topic, setTopic] = useState<string>();
  const lastRun = data?.lastRun;
  const items = data?.items ?? [];

  // Categories are whatever topics the flow has assigned to the stored items.
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
  // A topic picked earlier may be gone after a reload; fall back to everything.
  const active = topic !== undefined && counts.has(topic) ? topic : undefined;
  const shown = active ? items.filter((item) => item.topic === active) : items;

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

      {counts.size > 1 && (
        <nav>
          <button aria-pressed={!active} onClick={() => setTopic(undefined)}>
            All ({items.length})
          </button>
          {[...counts].map(([name, count]) => (
            <button key={name} aria-pressed={active === name} onClick={() => setTopic(name)}>
              {name} ({count})
            </button>
          ))}
        </nav>
      )}

      {shown.map((item) => (
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
