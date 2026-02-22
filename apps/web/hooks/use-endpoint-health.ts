"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface EndpointConfig {
  name: string;
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  category: string;
}

export interface EndpointResult {
  name: string;
  url: string;
  category: string;
  status: "pending" | "success" | "slow" | "error";
  responseTime: number | null;
  responseSize: number | null;
  statusCode: number | null;
  error: string | null;
}

function classifyStatus(
  responseTime: number,
  statusCode: number
): "success" | "slow" | "error" {
  if (statusCode >= 400) return "error";
  if (responseTime > 2000) return "slow";
  if (responseTime > 500) return "slow";
  return "success";
}

async function testEndpoint(
  config: EndpointConfig
): Promise<Omit<EndpointResult, "name" | "url" | "category">> {
  const start = performance.now();
  try {
    const res = await fetch(config.url, {
      method: config.method ?? "GET",
      headers: config.body ? { "Content-Type": "application/json" } : undefined,
      body: config.body ? JSON.stringify(config.body) : undefined,
    });
    const elapsed = performance.now() - start;
    const text = await res.text();
    return {
      status: classifyStatus(elapsed, res.status),
      responseTime: Math.round(elapsed),
      responseSize: text.length,
      statusCode: res.status,
      error: res.ok ? null : text.slice(0, 200),
    };
  } catch (err) {
    const elapsed = performance.now() - start;
    return {
      status: "error",
      responseTime: Math.round(elapsed),
      responseSize: null,
      statusCode: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function useEndpointHealth(endpoints: EndpointConfig[]) {
  const [results, setResults] = useState<EndpointResult[]>(() =>
    endpoints.map((ep) => ({
      name: ep.name,
      url: ep.url,
      category: ep.category,
      status: "pending" as const,
      responseTime: null,
      responseSize: null,
      statusCode: null,
      error: null,
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);

  const runAll = useCallback(async () => {
    abortRef.current = false;
    setIsRunning(true);
    // Reset all to pending
    setResults(
      endpoints.map((ep) => ({
        name: ep.name,
        url: ep.url,
        category: ep.category,
        status: "pending" as const,
        responseTime: null,
        responseSize: null,
        statusCode: null,
        error: null,
      }))
    );

    const settled = await Promise.allSettled(
      endpoints.map((ep) => testEndpoint(ep))
    );

    if (abortRef.current) return;

    setResults(
      endpoints.map((ep, i) => {
        const result = settled[i];
        if (result.status === "fulfilled") {
          return { name: ep.name, url: ep.url, category: ep.category, ...result.value };
        }
        return {
          name: ep.name,
          url: ep.url,
          category: ep.category,
          status: "error" as const,
          responseTime: null,
          responseSize: null,
          statusCode: null,
          error: "Promise rejected",
        };
      })
    );
    setIsRunning(false);
  }, [endpoints]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const summary = {
    total: results.length,
    passing: results.filter((r) => r.status === "success").length,
    slow: results.filter((r) => r.status === "slow").length,
    failed: results.filter((r) => r.status === "error").length,
    pending: results.filter((r) => r.status === "pending").length,
  };

  return { results, isRunning, runAll, summary };
}
