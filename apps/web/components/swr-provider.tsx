"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr-config";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 10000,
        keepPreviousData: true,
        revalidateOnFocus: false,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
