"use client";

import { useQuery } from "@tanstack/react-query";
import type { DigestRun } from "../digest.ts";

async function fetchDigest(): Promise<DigestRun> {
  const response = await fetch("/api/digest");
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  return body as DigestRun;
}

export default function Page() {
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["digest"],
    queryFn: fetchDigest,
  });

  return (
    <main>
      <header>
        <h1>News digest</h1>
        <button onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Running…" : "Refresh"}
        </button>
      </header>

      {isPending && <p className="muted">Running the flow…</p>}
      {error && <p className="error">Could not build the digest: {error.message}</p>}

      {data && (
        <>
          <p className="muted">
            Flow: {data.digest.flow} · {data.articleCount} articles in ·{" "}
            {data.usedSamples ? "sample articles (no feeds.json)" : "live feeds"} ·
            updated {new Date(dataUpdatedAt).toLocaleTimeString()}
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
