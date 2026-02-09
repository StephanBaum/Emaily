"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Plus, Trash2, Loader2, Save, Star } from "lucide-react";
import { useAgents, type AgentData } from "@/hooks/use-agents";

export default function AgentsSettingsPage() {
  const { agents, isLoading, mutate } = useAgents();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">AI Agents</h1>
        <div className="text-muted-foreground">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure AI agents with different personalities for drafting replies
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
        )}
      </div>

      {isCreating && (
        <AgentForm
          onSave={async (data) => {
            const res = await fetch("/api/agents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (res.ok) {
              setIsCreating(false);
              mutate();
            }
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <div className="space-y-4">
        {agents?.map((agent) => (
          <div key={agent.id}>
            {editingId === agent.id ? (
              <AgentForm
                agent={agent}
                onSave={async (data) => {
                  const res = await fetch(`/api/agents/${agent.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  });
                  if (res.ok) {
                    setEditingId(null);
                    mutate();
                  }
                }}
                onCancel={() => setEditingId(null)}
                onDelete={
                  agent.isDefault
                    ? undefined
                    : async () => {
                        const res = await fetch(`/api/agents/${agent.id}`, {
                          method: "DELETE",
                        });
                        if (res.ok) {
                          setEditingId(null);
                          mutate();
                        }
                      }
                }
              />
            ) : (
              <AgentCard
                agent={agent}
                onEdit={() => setEditingId(agent.id)}
              />
            )}
          </div>
        ))}
      </div>

      {(!agents || agents.length === 0) && !isCreating && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No agents configured yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create your first agent
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onEdit,
}: {
  agent: AgentData;
  onEdit: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-foreground/20 transition-colors"
      onClick={onEdit}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{agent.name}</CardTitle>
            {agent.isDefault && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Star className="h-3 w-3" />
                Default
              </Badge>
            )}
            {!agent.active && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Inactive
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            temp: {agent.temperature}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {agent.role && (
          <p className="text-sm text-muted-foreground">{agent.role}</p>
        )}
        {agent.systemPrompt && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {agent.systemPrompt}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface AgentFormData {
  name: string;
  role: string;
  systemPrompt: string;
  avatar: string;
  temperature: number;
  active: boolean;
  isDefault: boolean;
}

function AgentForm({
  agent,
  onSave,
  onCancel,
  onDelete,
}: {
  agent?: AgentData;
  onSave: (data: AgentFormData) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [form, setForm] = useState<AgentFormData>({
    name: agent?.name ?? "",
    role: agent?.role ?? "",
    systemPrompt: agent?.systemPrompt ?? "",
    avatar: agent?.avatar ?? "",
    temperature: agent?.temperature ?? 0.4,
    active: agent?.active ?? true,
    isDefault: agent?.isDefault ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Emaily, Support Bot"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-role">Role</Label>
              <Input
                id="agent-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Customer Support, Sales"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-prompt">System Prompt</Label>
            <Textarea
              id="agent-prompt"
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              placeholder="Define the agent's personality, tone, and behavior..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent-temp">
                Temperature: {form.temperature.toFixed(1)}
              </Label>
              <input
                id="agent-temp"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={form.temperature}
                onChange={(e) =>
                  setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm">Default agent</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving || !form.name.trim()}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {agent ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
