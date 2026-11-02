"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { AppBadge } from "@/ui/AppBadge";
import { PaceRoot } from "@/ui/kit/PaceRoot";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AppBadge />
      <PaceRoot />
      {children}
    </QueryClientProvider>
  );
}
