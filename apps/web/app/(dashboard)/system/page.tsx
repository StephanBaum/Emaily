"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useEndpointHealth,
  type EndpointConfig,
  type EndpointResult,
} from "@/hooks/use-endpoint-health";
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Server,
  Database,
  Brain,
  Bell,
  Shield,
  BarChart3,
} from "lucide-react";

const ENDPOINTS: EndpointConfig[] = [
  // Infrastructure
  { name: "AI / Ollama Status", url: "/api/ai/status", category: "Infrastructure" },
  { name: "IMAP Queue Health", url: "/api/imap/status", category: "Infrastructure" },

  // Core Data
  { name: "Threads", url: "/api/threads", category: "Core Data" },
  { name: "Threads (Archived)", url: "/api/threads?status=archived", category: "Core Data" },
  { name: "Tags", url: "/api/tags", category: "Core Data" },
  { name: "Mailboxes", url: "/api/mailboxes", category: "Core Data" },

  // AI Pipeline
  { name: "AI Pending Queue", url: "/api/ai/pending", category: "AI Pipeline" },
  { name: "AI Summary", url: "/api/ai/summary?hours=24", category: "AI Pipeline" },

  // Notifications & User
  { name: "Unread Count", url: "/api/notifications/unread-count", category: "Notifications & User" },
  { name: "Notifications", url: "/api/notifications", category: "Notifications & User" },
  { name: "User Profile", url: "/api/user/profile", category: "Notifications & User" },

  // Auth & Session
  { name: "Session", url: "/api/auth/session", category: "Auth & Session" },

  // Database Stats
  { name: "System Stats", url: "/api/system/stats", category: "Database Stats" },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Infrastructure: <Server className="h-4 w-4" />,
  "Core Data": <Database className="h-4 w-4" />,
  "AI Pipeline": <Brain className="h-4 w-4" />,
  "Notifications & User": <Bell className="h-4 w-4" />,
  "Auth & Session": <Shield className="h-4 w-4" />,
  "Database Stats": <BarChart3 className="h-4 w-4" />,
};

const CATEGORY_ORDER = [
  "Infrastructure",
  "Core Data",
  "AI Pipeline",
  "Notifications & User",
  "Auth & Session",
  "Database Stats",
];

function StatusBadge({ status }: { status: EndpointResult["status"] }) {
  switch (status) {
    case "success":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          OK
        </Badge>
      );
    case "slow":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/15">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Slow
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/15">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground border-muted hover:bg-muted">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EndpointCard({ result }: { result: EndpointResult }) {
  return (
    <Card
      className={
        result.status === "error"
          ? "border-red-500/30"
          : result.status === "slow"
            ? "border-amber-500/30"
            : ""
      }
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{result.name}</span>
          <StatusBadge status={result.status} />
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {result.url}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {result.responseTime !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {result.responseTime} ms
            </span>
          )}
          {result.responseSize !== null && (
            <span>{formatBytes(result.responseSize)}</span>
          )}
          {result.statusCode !== null && (
            <span className="font-mono">{result.statusCode}</span>
          )}
        </div>
        {result.error && (
          <p className="text-xs text-red-500 truncate" title={result.error}>
            {result.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemDashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { results, isRunning, runAll, summary } = useEndpointHealth(ENDPOINTS);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Admin guard
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    if ((session.user as { role?: string }).role !== "admin") {
      router.replace("/inbox");
    }
  }, [session, sessionStatus, router]);

  // Auto-run on mount
  const hasRun = useMemo(() => ({ current: false }), []);
  useEffect(() => {
    if (sessionStatus !== "loading" && session?.user && !hasRun.current) {
      hasRun.current = true;
      runAll();
    }
  }, [sessionStatus, session, runAll, hasRun]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      runAll();
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, runAll]);

  const grouped = useMemo(() => {
    const map = new Map<string, EndpointResult[]>();
    for (const r of results) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    return map;
  }, [results]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh((v) => !v);
  }, []);

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if ((session?.user as { role?: string } | undefined)?.role !== "admin") {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">System Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAutoRefresh}
            className={autoRefresh ? "border-emerald-500 text-emerald-600" : ""}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button onClick={runAll} disabled={isRunning} size="sm">
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRunning ? "animate-spin" : ""}`}
            />
            Run All
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Passing" value={summary.passing} color="text-emerald-600" />
        <SummaryCard label="Slow" value={summary.slow} color="text-amber-600" />
        <SummaryCard label="Failed" value={summary.failed} color="text-red-600" />
        <SummaryCard label="Pending" value={summary.pending} color="text-muted-foreground" />
      </div>

      {/* Categorized Endpoint Cards */}
      {CATEGORY_ORDER.map((category) => {
        const items = grouped.get(category);
        if (!items) return null;
        return (
          <section key={category}>
            <div className="flex items-center gap-2 mb-3">
              {CATEGORY_ICONS[category]}
              <h2 className="text-lg font-semibold">{category}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((r) => (
                <EndpointCard key={r.url} result={r} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
