"use client";

import { useQuery } from "@tanstack/react-query";
import type { DigestRun } from "../digest.ts";

/** Reads the stored run. `null` means no run has finished yet. */
async function fetchRun(): Promise<DigestRun | null> {
  const response = await fetch("/api/digest");
  const body = (await response.json()) as { run?: DigestRun | null; error?: string };
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body.run ?? null;
}

export default function Page() {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["digest"],
    queryFn: fetchRun,
  });

  return (
    <main>
      <header>
        <h1>News digest</h1>
        <button onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Loading…" : "Reload"}
        </button>
      </header>

      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">Could not load the digest: {error.message}</p>}

      {data === null && (
        <p className="muted">
          No run has finished yet. One starts when the app launches; reload in a moment.
        </p>
      )}

      {data && (
        <>
          <p className="muted">
            Flow: {data.digest.flow} · {data.articleCount} articles in ·{" "}
            {data.usedSamples ? "sample articles (no feeds.json)" : "live feeds"} ·
            ran {new Date(data.ranAt).toLocaleString()}
          </p>
          {data.failures.map(({ feedUrl, reason }) => (
            <p key={feedUrl} className="error">
              Skipped {feedUrl}: {reason}
            </p>
          ))}
          {data.digest.sections.length === 0 && (
            <p className="muted">No articles scored above the threshold.</p>
          )}
          {data.digest.sections.map(({ topic, items }) => (
            <section key={topic}>
              <h2>{topic}</h2>
              {items.map((item) => (
                <article key={item.url}>
                  <span className="score">{item.score}</span>
                  <div>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                    <p>{item.summary}</p>
                    <p className="muted">{item.source}</p>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </>
      )}
    </main>
  );
}
