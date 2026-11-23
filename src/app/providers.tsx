"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // The page only reads the stored run, which changes about once a day.
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000 } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
