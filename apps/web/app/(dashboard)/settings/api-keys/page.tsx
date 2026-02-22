"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ApiKeyEntry {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await fetch("/api/auth/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!keyName.trim()) return;
    setGenerating(true);
    setMessage(null);
    setNewKey(null);
    try {
      const res = await fetch("/api/auth/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim(), scopes: ["*"] }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(data.key);
        setKeyName("");
        setMessage({ type: "success", text: "API key created" });
        // Refresh the keys list
        await fetchKeys();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create key" });
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/auth/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        setMessage({ type: "success", text: "API key revoked" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to revoke key" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to revoke key" });
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setMessage({ type: "success", text: "Copied to clipboard" });
    } catch {
      setMessage({ type: "error", text: "Failed to copy" });
    }
  }

  function formatDate(dateStr: string) {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">API Keys</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">API Keys</h1>
      <p className="text-muted-foreground mb-6">
        Generate API keys for programmatic access. Use with Claude Desktop, custom agents, or scripts.
      </p>

      {message && (
        <p className={`text-sm mb-4 ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate New Key</CardTitle>
            <CardDescription>Create a new API key for agent access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="keyName"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g., Claude Desktop, My Script"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleGenerate();
                    }}
                  />
                  <Button onClick={handleGenerate} disabled={generating || !keyName.trim()}>
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Generate Key
                  </Button>
                </div>
              </div>
            </div>

            {newKey && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                <p className="text-sm font-medium text-destructive">
                  Save this key now — it won&apos;t be shown again.
                </p>
                <div className="flex gap-2">
                  <Input value={newKey} readOnly className="font-mono text-sm" />
                  <Button variant="outline" onClick={copyKey}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <details>
                  <summary className="text-sm text-muted-foreground cursor-pointer">
                    Claude Desktop config snippet
                  </summary>
                  <pre className="mt-2 p-3 bg-background rounded text-xs overflow-x-auto">
                    {JSON.stringify(
                      {
                        mcpServers: {
                          emaily: {
                            command: "node",
                            args: ["path/to/packages/mcp-server/dist/index.js"],
                            env: {
                              EMAILY_API_KEY: newKey,
                              EMAILY_BASE_URL: "http://localhost:3000",
                            },
                          },
                        },
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Keys</CardTitle>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <p className="text-muted-foreground">No API keys yet.</p>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {key.keyPrefix}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDate(key.createdAt)}
                        {key.lastUsedAt && ` \u00b7 Last used ${formatDate(key.lastUsedAt)}`}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(key.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
