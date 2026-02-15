"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Plug,
  Save,
  X,
} from "lucide-react";

interface MailboxFormData {
  emailAddress: string;
  displayName: string;
  type: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  signature: string;
  folderInbox: string;
  folderArchive: string;
  folderTrash: string;
  folderDrafts: string;
  folderSent: string;
  folderSpam: string;
}

interface ConnectionResult {
  imap: { success: boolean; folders?: string[]; error?: string };
  smtp: { success: boolean; error?: string };
}

interface MailboxFormProps {
  mode: "create" | "edit";
  initialData?: Partial<MailboxFormData>;
  mailboxId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const DEFAULT_FORM: MailboxFormData = {
  emailAddress: "",
  displayName: "",
  type: "personal",
  imapHost: "",
  imapPort: 993,
  imapUser: "",
  imapPassword: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  signature: "",
  folderInbox: "INBOX",
  folderArchive: "Archive",
  folderTrash: "Trash",
  folderDrafts: "Drafts",
  folderSent: "Sent",
  folderSpam: "Junk",
};

export function MailboxForm({
  mode,
  initialData,
  mailboxId,
  onSuccess,
  onCancel,
}: MailboxFormProps) {
  const [form, setForm] = useState<MailboxFormData>({
    ...DEFAULT_FORM,
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] =
    useState<ConnectionResult | null>(null);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof MailboxFormData>(
    field: K,
    value: MailboxFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleTestConnection() {
    setTesting(true);
    setConnectionResult(null);
    setError(null);

    try {
      const res = await fetch("/api/mailboxes/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imapHost: form.imapHost,
          imapPort: form.imapPort,
          imapUser: form.imapUser,
          imapPassword: form.imapPassword,
          smtpHost: form.smtpHost,
          smtpPort: form.smtpPort,
          smtpUser: form.smtpUser,
          smtpPassword: form.smtpPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Connection test failed");
        return;
      }

      const result: ConnectionResult = await res.json();
      setConnectionResult(result);

      // If IMAP succeeded with folders, populate the folder list
      if (result.imap.success && result.imap.folders) {
        setAvailableFolders(result.imap.folders);
      }
    } catch {
      setError("Failed to test connection");
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url =
        mode === "edit" ? `/api/mailboxes/${mailboxId}` : "/api/mailboxes";
      const method = mode === "edit" ? "PATCH" : "POST";

      const payload: Record<string, unknown> = { ...form };
      // Only include password fields if they have values (for edit mode, blank means no change)
      if (mode === "edit" && !form.imapPassword) {
        delete payload.imapPassword;
      }
      if (mode === "edit" && !form.smtpPassword) {
        delete payload.smtpPassword;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save mailbox");
        return;
      }

      onSuccess();
    } catch {
      setError("Failed to save mailbox");
    } finally {
      setSaving(false);
    }
  }

  function renderFolderSelect(
    label: string,
    field: keyof MailboxFormData,
    value: string
  ) {
    if (availableFolders.length === 0) {
      return (
        <div className="space-y-2">
          <Label>{label}</Label>
          <Input
            value={value}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={label}
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={value}
          onChange={(e) => updateField(field, e.target.value)}
        >
          <option value="">-- Select folder --</option>
          {availableFolders.map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailAddress">Email Address</Label>
            <Input
              id="emailAddress"
              type="email"
              value={form.emailAddress}
              onChange={(e) => updateField("emailAddress", e.target.value)}
              placeholder="user@example.com"
              required
              disabled={mode === "edit"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => updateField("displayName", e.target.value)}
              placeholder="My Work Email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={form.type}
              onChange={(e) => updateField("type", e.target.value)}
            >
              <option value="personal">Personal</option>
              <option value="shared">Shared</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* IMAP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">IMAP (Incoming Mail)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="imapHost">Host</Label>
              <Input
                id="imapHost"
                value={form.imapHost}
                onChange={(e) => updateField("imapHost", e.target.value)}
                placeholder="imap.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imapPort">Port</Label>
              <Input
                id="imapPort"
                type="number"
                value={form.imapPort}
                onChange={(e) =>
                  updateField("imapPort", parseInt(e.target.value) || 993)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imapUser">Username</Label>
            <Input
              id="imapUser"
              value={form.imapUser}
              onChange={(e) => updateField("imapUser", e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imapPassword">Password</Label>
            <Input
              id="imapPassword"
              type="password"
              value={form.imapPassword}
              onChange={(e) => updateField("imapPassword", e.target.value)}
              placeholder={
                mode === "edit" ? "Leave blank to keep current" : "Password"
              }
              required={mode === "create"}
            />
          </div>
        </CardContent>
      </Card>

      {/* SMTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SMTP (Outgoing Mail)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="smtpHost">Host</Label>
              <Input
                id="smtpHost"
                value={form.smtpHost}
                onChange={(e) => updateField("smtpHost", e.target.value)}
                placeholder="smtp.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                type="number"
                value={form.smtpPort}
                onChange={(e) =>
                  updateField("smtpPort", parseInt(e.target.value) || 587)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpUser">Username</Label>
            <Input
              id="smtpUser"
              value={form.smtpUser}
              onChange={(e) => updateField("smtpUser", e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpPassword">Password</Label>
            <Input
              id="smtpPassword"
              type="password"
              value={form.smtpPassword}
              onChange={(e) => updateField("smtpPassword", e.target.value)}
              placeholder={
                mode === "edit" ? "Leave blank to keep current" : "Password"
              }
              required={mode === "create"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !form.imapHost || !form.smtpHost}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plug className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>

          {connectionResult && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {connectionResult.imap.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span>
                  IMAP:{" "}
                  {connectionResult.imap.success
                    ? `Connected (${connectionResult.imap.folders?.length || 0} folders found)`
                    : connectionResult.imap.error || "Failed"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {connectionResult.smtp.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span>
                  SMTP:{" "}
                  {connectionResult.smtp.success
                    ? "Connected"
                    : connectionResult.smtp.error || "Failed"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Folder Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Folder Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableFolders.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Test the IMAP connection to auto-detect available folders, or
              enter folder names manually.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {renderFolderSelect("Inbox", "folderInbox", form.folderInbox)}
            {renderFolderSelect("Archive", "folderArchive", form.folderArchive)}
            {renderFolderSelect("Trash", "folderTrash", form.folderTrash)}
            {renderFolderSelect("Drafts", "folderDrafts", form.folderDrafts)}
            {renderFolderSelect("Sent", "folderSent", form.folderSent)}
            {renderFolderSelect("Spam", "folderSpam", form.folderSpam)}
          </div>
        </CardContent>
      </Card>

      {/* Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Signature</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.signature}
            onChange={(e) => updateField("signature", e.target.value)}
            placeholder="Your email signature..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {mode === "create" ? "Add Mailbox" : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
