"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
      </div>
    </div>
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
