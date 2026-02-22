"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_AGENTS, type DefaultAgent } from "@/lib/default-agents";
import {
  ArrowRight,
  Check,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

interface OnboardingWizardProps {
  userName: string;
  teamName: string;
}

function AgentAvatar({
  name,
  color,
  size = "lg",
}: {
  name: string;
  color: string;
  size?: "lg" | "sm";
}) {
  const sizeClasses = size === "lg" ? "h-14 w-14 text-xl" : "h-8 w-8 text-sm";
  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {name[0]}
    </div>
  );
}

export function OnboardingWizard({ userName, teamName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(
    new Set(["Emaily"])
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customAgent, setCustomAgent] = useState({
    name: "",
    role: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleAgent(name: string) {
    if (name === "Emaily") return; // Can't deselect default
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      const payload: {
        agentNames: string[];
        customAgent?: { name: string; role: string; description: string };
      } = {
        agentNames: Array.from(selectedAgents),
      };

      if (customAgent.name.trim()) {
        payload.customAgent = customAgent;
      }

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      setStep(3);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Step 1: Welcome
  if (step === 1) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mx-auto">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Welcome to Emaily, {userName}!</h1>
            <p className="text-muted-foreground">
              Team <span className="font-medium text-foreground">{teamName}</span> is ready to go.
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Emaily uses AI agents to help your team draft replies, handle
              support, manage sales outreach, and more. Let&apos;s pick the
              agents that fit your workflow.
            </p>
          </div>
          <Button onClick={() => setStep(2)} size="lg" className="gap-2">
            Meet Your AI Team
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Agent Selection
  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Meet Your AI Team</h1>
          <p className="text-sm text-muted-foreground">
            Select which agents to activate. You can always change this later in
            Settings.
          </p>
        </div>

        <div className="grid gap-3">
          {DEFAULT_AGENTS.map((agent) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              selected={selectedAgents.has(agent.name)}
              locked={agent.name === "Emaily"}
              onToggle={() => toggleAgent(agent.name)}
            />
          ))}
        </div>

        {/* Custom Agent */}
        {!showCustomForm ? (
          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full border border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add a Custom Agent
          </button>
        ) : (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Custom Agent</Label>
                <button
                  onClick={() => {
                    setShowCustomForm(false);
                    setCustomAgent({ name: "", role: "", description: "" });
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                placeholder="Agent name (e.g. Casey)"
                value={customAgent.name}
                onChange={(e) =>
                  setCustomAgent((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Input
                placeholder="Role (e.g. Marketing Copywriter)"
                value={customAgent.role}
                onChange={(e) =>
                  setCustomAgent((prev) => ({ ...prev, role: e.target.value }))
                }
              />
              <Input
                placeholder="Brief description of what this agent does"
                value={customAgent.description}
                onChange={(e) =>
                  setCustomAgent((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </CardContent>
          </Card>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            size="lg"
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Activate Agents
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Done
  const finalAgents = DEFAULT_AGENTS.filter((a) => selectedAgents.has(a.name));

  return (
    <Card>
      <CardContent className="pt-10 pb-10 text-center space-y-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Your AI team is ready</h1>
          <p className="text-sm text-muted-foreground">
            {finalAgents.length} agent{finalAgents.length !== 1 ? "s" : ""}{" "}
            activated
            {customAgent.name.trim()
              ? ` + ${customAgent.name.trim()}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {finalAgents.map((agent) => (
            <div
              key={agent.name}
              className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5"
            >
              <AgentAvatar name={agent.name} color={agent.color} size="sm" />
              <span className="text-sm font-medium">{agent.name}</span>
            </div>
          ))}
          {customAgent.name.trim() && (
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
              <AgentAvatar name={customAgent.name} color="#6b7280" size="sm" />
              <span className="text-sm font-medium">{customAgent.name}</span>
            </div>
          )}
        </div>

        <Button
          onClick={() => router.push("/inbox")}
          size="lg"
          className="gap-2"
        >
          Go to Inbox
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function AgentCard({
  agent,
  selected,
  locked,
  onToggle,
}: {
  agent: DefaultAgent;
  selected: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={locked}
      className={`w-full text-left rounded-lg border p-4 transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/30"
      } ${locked ? "cursor-default" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-4">
        <AgentAvatar name={agent.name} color={agent.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{agent.name}</span>
            <span className="text-xs text-muted-foreground">{agent.role}</span>
            {locked && (
              <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {agent.description}
          </p>
        </div>
        <div
          className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30"
          }`}
        >
          {selected && <Check className="h-3 w-3" />}
        </div>
      </div>
    </button>
  );
}
