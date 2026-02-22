"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { usePreferences } from "@/contexts/preferences-context";

export default function PreferencesPage() {
  const { preferences, updatePreferences, isLoading } = usePreferences();

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Preferences</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Preferences</h1>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => updatePreferences({ theme })}
                    className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      preferences.theme === theme
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Display Density</Label>
              <div className="flex gap-2">
                {(["comfortable", "compact"] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => updatePreferences({ density })}
                    className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      preferences.density === density
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {density.charAt(0).toUpperCase() + density.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date Format</Label>
              <div className="flex gap-2">
                {(["relative", "absolute", "iso"] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => updatePreferences({ dateFormat: format })}
                    className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      preferences.dateFormat === format
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {format === "iso" ? "ISO" : format.charAt(0).toUpperCase() + format.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Preview Lines</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => updatePreferences({ previewLines: n })}
                    className={`w-10 h-10 rounded-md border text-sm font-medium transition-colors ${
                      preferences.previewLines === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Control how you receive notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Browser notifications"
              description="Show desktop notifications for new events"
              checked={preferences.notifications.browser}
              onChange={(browser) =>
                updatePreferences({
                  notifications: { ...preferences.notifications, browser },
                })
              }
            />
            <ToggleRow
              label="Sound"
              description="Play a sound when a notification arrives"
              checked={preferences.notifications.sound}
              onChange={(sound) =>
                updatePreferences({
                  notifications: { ...preferences.notifications, sound },
                })
              }
            />
            <ToggleRow
              label="Daily digest email"
              description="Receive a daily summary of activity"
              checked={preferences.notifications.digestEmail}
              onChange={(digestEmail) =>
                updatePreferences({
                  notifications: { ...preferences.notifications, digestEmail },
                })
              }
            />
          </CardContent>
        </Card>

        <AIModelCard />
      </div>
    </div>
  );
}

function AIModelCard() {
  const [provider, setProvider] = useState<"ollama" | "gemini">("ollama");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);

  // Load current settings
  useEffect(() => {
    fetch("/api/team/ai-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.aiProvider) setProvider(data.aiProvider);
        if (data.aiModel) setModel(data.aiModel);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch models when provider changes
  const fetchModels = useCallback((p: "ollama" | "gemini") => {
    setModelsLoading(true);
    setModelsError(null);
    fetch(`/api/ai/models?provider=${p}`)
      .then((res) => res.json())
      .then((data) => {
        setModels(data.models || []);
        if (data.error) {
          setModelsError(data.error);
          if (p === "ollama") setOllamaReachable(false);
        } else {
          if (p === "ollama") setOllamaReachable(true);
        }
      })
      .catch(() => {
        setModels([]);
        setModelsError("Failed to fetch models");
        if (p === "ollama") setOllamaReachable(false);
      })
      .finally(() => setModelsLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchModels(provider);
    }
  }, [provider, loading, fetchModels]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProvider: provider, aiModel: model || null }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "AI settings saved" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Model</CardTitle>
        <CardDescription>
          Choose the AI provider and model for email processing. Applies to all team members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <div className="flex gap-2">
            {(["ollama", "gemini"] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setProvider(p);
                  setModel("");
                }}
                className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                  provider === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                }`}
              >
                {p === "ollama" ? "Local (Ollama)" : "Cloud (Gemini)"}
              </button>
            ))}
          </div>
          {provider === "ollama" && ollamaReachable !== null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  ollamaReachable ? "bg-green-500" : "bg-red-500"
                }`}
              />
              {ollamaReachable ? "Connected" : "Not reachable"}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          {modelsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading models...
            </div>
          ) : modelsError && models.length === 0 ? (
            <p className="text-sm text-muted-foreground">{modelsError}</p>
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Default</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
          {message && (
            <p className={message.type === "success" ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {message.text}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
