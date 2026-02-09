"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Intent {
  type: "question" | "request" | "info";
  text: string;
  priority: number;
}

interface EmailIntentRecord {
  id: string;
  emailId: string;
  intents: Intent[];
  email: {
    id: string;
    fromAddress: string;
    fromName: string | null;
    subject: string;
    date: string;
  };
}

interface IntentPanelProps {
  threadId: string;
}

const typeConfig = {
  question: { label: "Question", color: "text-blue-600 bg-blue-50 border-blue-200" },
  request: { label: "Request", color: "text-amber-600 bg-amber-50 border-amber-200" },
  info: { label: "Info", color: "text-zinc-600 bg-zinc-50 border-zinc-200" },
};

const priorityConfig: Record<number, string> = {
  1: "border-l-red-400",
  2: "border-l-amber-400",
  3: "border-l-zinc-300",
};

export function IntentPanel({ threadId }: IntentPanelProps) {
  const [records, setRecords] = useState<EmailIntentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ tags: number; intents: number; draft: boolean } | null>(null);

  const fetchIntents = useCallback(async () => {
    try {
      const res = await fetch(`/api/threads/${threadId}/intents`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch {
      // Silently fail — intents are supplementary
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchIntents();
  }, [fetchIntents]);

  async function handleProcess() {
    setProcessing(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.result ?? null);
        // Re-fetch intents after processing
        await fetchIntents();
      }
    } catch {
      // ignore
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground">Loading intents...</div>
    );
  }

  const allIntents = records.flatMap((r) =>
    (r.intents as Intent[]).map((intent) => ({
      ...intent,
      emailFrom: r.email.fromName || r.email.fromAddress,
    }))
  );

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={handleProcess}
        disabled={processing}
      >
        {processing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {processing ? "Processing..." : "Analyze with AI"}
      </Button>

      {result && (
        <div className="rounded border bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          {result.tags > 0 && <span>{result.tags} tag(s) applied. </span>}
          {result.intents > 0 && <span>{result.intents} intent(s) found. </span>}
          {result.draft && <span>Draft generated. </span>}
          {result.tags === 0 && result.intents === 0 && <span>No results.</span>}
        </div>
      )}

      {allIntents.length === 0 ? (
        <div className="text-xs text-muted-foreground">No intents extracted yet</div>
      ) : (
        allIntents.map((intent, i) => (
          <div
            key={i}
            className={cn(
              "rounded border border-l-2 px-2 py-1.5 text-xs",
              priorityConfig[intent.priority] || priorityConfig[3]
            )}
          >
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn("h-4 px-1 text-[10px]", typeConfig[intent.type].color)}
              >
                {typeConfig[intent.type].label}
              </Badge>
              {intent.priority === 1 && (
                <span className="text-[10px] font-medium text-red-500">High</span>
              )}
            </div>
            <p className="mt-1 leading-snug text-foreground">{intent.text}</p>
          </div>
        ))
      )}
    </div>
  );
}
