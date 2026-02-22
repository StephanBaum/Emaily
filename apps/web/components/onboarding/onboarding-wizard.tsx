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
  Trash2,
  X,
} from "lucide-react";

interface OnboardingWizardProps {
  userName: string;
  teamName: string;
}

interface CustomAgentDraft {
  name: string;
  role: string;
  description: string;
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
  const [customAgents, setCustomAgents] = useState<CustomAgentDraft[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [draft, setDraft] = useState<CustomAgentDraft>({
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

  function addCustomAgent() {
    if (!draft.name.trim()) return;
    setCustomAgents((prev) => [...prev, { ...draft }]);
    setDraft({ name: "", role: "", description: "" });
    setShowCustomForm(false);
  }

  function removeCustomAgent(index: number) {
    setCustomAgents((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      const payload: {
        agentNames: string[];
        customAgents?: CustomAgentDraft[];
      } = {
        agentNames: Array.from(selectedAgents),
      };

      if (customAgents.length > 0) {
        payload.customAgents = customAgents;
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

        {/* Added Custom Agents */}
        {customAgents.length > 0 && (
          <div className="space-y-2">
            {customAgents.map((agent, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 p-3"
              >
                <AgentAvatar name={agent.name} color="#6b7280" size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{agent.name}</span>
                    <span className="text-xs text-muted-foreground">{agent.role}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                </div>
                <button
                  onClick={() => removeCustomAgent(index)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Custom Agent Form */}
        {showCustomForm ? (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">New Custom Agent</Label>
                <button
                  onClick={() => {
                    setShowCustomForm(false);
                    setDraft({ name: "", role: "", description: "" });
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                placeholder="Agent name (e.g. Casey)"
                value={draft.name}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Input
                placeholder="Role (e.g. Marketing Copywriter)"
                value={draft.role}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, role: e.target.value }))
                }
              />
              <Input
                placeholder="Describe what this agent should do"
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll generate a detailed system prompt from your description.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={addCustomAgent}
                disabled={!draft.name.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full border border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add a Custom Agent
          </button>
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
            {finalAgents.length + customAgents.length} agent
            {finalAgents.length + customAgents.length !== 1 ? "s" : ""}{" "}
            activated
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
          {customAgents.map((agent, index) => (
            <div
              key={`custom-${index}`}
              className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5"
            >
              <AgentAvatar name={agent.name} color="#6b7280" size="sm" />
              <span className="text-sm font-medium">{agent.name}</span>
            </div>
          ))}
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
