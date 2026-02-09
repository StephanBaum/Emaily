"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldQuestion, Crown, Shield, ShieldAlert } from "lucide-react";
import type { TrustLevel } from "@emailautomation/shared";

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

export function SenderInfoPanel({
  threadId,
  senderEmail,
  senderName,
  senderTrustLevel,
  contactId,
  spamScore,
  threadStatus,
}: SenderInfoPanelProps) {
  const router = useRouter();
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(senderTrustLevel || "stranger");
  const [isSaving, setIsSaving] = useState(false);
  const [isUnquarantining, setIsUnquarantining] = useState(false);

  const trust = TRUST_CONFIG[trustLevel];
  const TrustIcon = trust.icon;

  async function handleTrustChange(newLevel: string) {
    if (!contactId) return;
    const level = newLevel as TrustLevel;
    setTrustLevel(level);
    setIsSaving(true);
    try {
      await fetch(`/api/contacts/${contactId}/trust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustLevel: level }),
      });
      router.refresh();
    } catch {
      setTrustLevel(trustLevel); // revert
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
      // Elevate contact trust to known
      if (contactId) {
        await fetch(`/api/contacts/${contactId}/trust`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trustLevel: "known" }),
        });
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

      {/* Trust level selector */}
      {contactId && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Trust Level</label>
          <select
            value={trustLevel}
            onChange={(e) => handleTrustChange(e.target.value)}
            disabled={isSaving}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="stranger">Stranger</option>
            <option value="known">Known</option>
            <option value="trusted">Trusted</option>
            <option value="vip">VIP</option>
          </select>
        </div>
      )}

      {/* Spam score */}
      {spamScore !== null && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Spam Score</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  spamScore >= 0.7
                    ? "bg-red-500"
                    : spamScore >= 0.4
                      ? "bg-orange-400"
                      : "bg-green-500"
                }`}
                style={{ width: `${Math.round(spamScore * 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right">
              {Math.round(spamScore * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Quarantine action */}
      {threadStatus === "quarantined" && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleMarkNotSpam}
          disabled={isUnquarantining}
        >
          <ShieldAlert className="mr-2 h-3.5 w-3.5" />
          {isUnquarantining ? "Restoring..." : "Mark as Not Spam"}
        </Button>
      )}
    </div>
  );
}
