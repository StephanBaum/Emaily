"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldQuestion, Crown, Shield, ShieldAlert } from "lucide-react";
import type { TrustLevel } from "@emaily/shared";

interface SenderInfoPanelProps {
  threadId: string;
  senderEmail: string;
  senderName: string | null;
  senderTrustLevel: TrustLevel | null;
  contactId: string | null;
  spamScore: number | null;
  threadStatus: string;
}

const TRUST_CONFIG: Record<TrustLevel, { label: string; color: string; icon: typeof Shield }> = {
  stranger: { label: "Stranger", color: "text-orange-500", icon: ShieldQuestion },
  known: { label: "Known", color: "text-blue-500", icon: Shield },
  trusted: { label: "Trusted", color: "text-green-500", icon: ShieldCheck },
  vip: { label: "VIP", color: "text-amber-500", icon: Crown },
};

function SpamScoreRing({ score }: { score: number }) {
  const size = 22;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - score * circumference;
  const pct = Math.round(score * 100);

  const color =
    score >= 0.7 ? "stroke-red-500" : score >= 0.4 ? "stroke-orange-400" : "stroke-green-500";

  return (
    <div className="relative inline-flex items-center gap-1.5" title={`Spam score: ${pct}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function SenderInfoPanel({
  threadId,
  senderEmail,
  senderName,
  senderTrustLevel,
  contactId: initialContactId,
  spamScore,
  threadStatus,
}: SenderInfoPanelProps) {
  const router = useRouter();
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(senderTrustLevel || "stranger");
  const [contactId, setContactId] = useState<string | null>(initialContactId);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnquarantining, setIsUnquarantining] = useState(false);

  const trust = TRUST_CONFIG[trustLevel];
  const TrustIcon = trust.icon;

  async function handleTrustChange(newLevel: string) {
    const level = newLevel as TrustLevel;
    const prevLevel = trustLevel;
    setTrustLevel(level);
    setIsSaving(true);
    try {
      if (contactId) {
        // Update existing contact
        await fetch(`/api/contacts/${contactId}/trust`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trustLevel: level }),
        });
      } else {
        // Create contact via upsert endpoint
        const res = await fetch("/api/contacts/trust", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: senderEmail,
            trustLevel: level,
            name: senderName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setContactId(data.id);
        }
      }
      router.refresh();
    } catch {
      setTrustLevel(prevLevel);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkNotSpam() {
    setIsUnquarantining(true);
    try {
      // Set thread status to open
      await fetch(`/api/threads/${threadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });
      // Remove spam tag if present
      const tagsRes = await fetch(`/api/tags?context=picker`);
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        const spamTag = tags.find((t: { name: string }) => t.name.toLowerCase() === "spam");
        if (spamTag) {
          await fetch(`/api/threads/${threadId}/tags?tagId=${spamTag.id}`, {
            method: "DELETE",
          });
        }
      }
      // Elevate contact trust to known (via upsert so it works even without existing contact)
      const res = await fetch("/api/contacts/trust", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: senderEmail,
          trustLevel: "known",
          name: senderName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setContactId(data.id);
        setTrustLevel("known");
      }
      router.refresh();
    } catch {
      // ignore
    } finally {
      setIsUnquarantining(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Sender info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <TrustIcon className={`h-4 w-4 ${trust.color}`} />
          <span className="text-sm font-medium">{senderName || senderEmail}</span>
        </div>
        {senderName && (
          <p className="text-xs text-muted-foreground pl-6">{senderEmail}</p>
        )}
      </div>

      {/* Trust level selector — always visible */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Trust Level</label>
        <select
          value={trustLevel}
          onChange={(e) => handleTrustChange(e.target.value)}
          disabled={isSaving}
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="stranger" className="bg-popover text-popover-foreground">Stranger</option>
          <option value="known" className="bg-popover text-popover-foreground">Known</option>
          <option value="trusted" className="bg-popover text-popover-foreground">Trusted</option>
          <option value="vip" className="bg-popover text-popover-foreground">VIP</option>
        </select>
      </div>

      {/* Quarantine action with inline spam score */}
      {threadStatus === "quarantined" && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleMarkNotSpam}
            disabled={isUnquarantining}
          >
            <ShieldAlert className="mr-2 h-3.5 w-3.5" />
            {isUnquarantining ? "Restoring..." : "Mark as Not Spam"}
          </Button>
          {spamScore !== null && spamScore > 0 && (
            <SpamScoreRing score={spamScore} />
          )}
        </div>
      )}

      {/* Spam score shown standalone when not quarantined but score is notable */}
      {threadStatus !== "quarantined" && spamScore !== null && spamScore >= 0.4 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Spam risk</span>
          <SpamScoreRing score={spamScore} />
        </div>
      )}
    </div>
  );
}
