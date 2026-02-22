"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSWRConfig } from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Shield, ShieldOff } from "lucide-react";
import { AvatarUpload } from "@/components/settings/avatar-upload";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  teamName: string;
  hasAvatar: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const { mutate } = useSWRConfig();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setName(data.name);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!name.trim() || name.trim() === profile?.name) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile((prev) => prev ? { ...prev, name: updated.name } : prev);
        setMessage({ type: "success", text: "Profile updated" });
        await updateSession({ name: updated.name });
        // Revalidate shared profile cache so sidebar updates immediately
        mutate("/api/user/profile");
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed to update" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Profile</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarUpload
              userId={profile.id}
              userName={profile.name}
              hasAvatar={profile.hasAvatar}
              onAvatarChange={(has) => {
                setProfile((prev) => prev ? { ...prev, hasAvatar: has } : prev);
                // Revalidate shared profile cache so sidebar avatar updates
                mutate("/api/user/profile");
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
                <Button
                  onClick={handleSave}
                  disabled={saving || name.trim() === profile.name}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed from settings.
              </p>
            </div>

            {message && (
              <p className={message.type === "success" ? "text-sm text-green-600" : "text-sm text-destructive"}>
                {message.text}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="outline">{profile.role}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Team</span>
              <span>{profile.teamName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span>{new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <PasswordSection />
        <TotpSection />
      </div>
    </div>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Password updated" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update password" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Update your password to keep your account secure.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters with uppercase, lowercase, and number.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {message && (
            <p className={message.type === "success" ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TotpSection() {
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((data) => {
        setTotpEnabled(data.totpEnabled ?? false);
      });
  }, []);

  async function handleSetup() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/totp/setup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSetupUri(data.uri);
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setTotpEnabled(true);
        setSetupUri(null);
        setVerifyCode("");
        setMessage({ type: "success", text: "2FA enabled successfully" });
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/totp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setTotpEnabled(false);
        setDisablePassword("");
        setMessage({ type: "success", text: "2FA disabled" });
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-Factor Authentication
          {totpEnabled !== null && (
            <Badge variant={totpEnabled ? "default" : "secondary"}>
              {totpEnabled ? "Enabled" : "Disabled"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Add an extra layer of security with a TOTP authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        {!totpEnabled && !setupUri && (
          <Button onClick={handleSetup} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Enable 2FA
          </Button>
        )}

        {setupUri && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scan this QR code with your authenticator app:</Label>
              <div className="bg-white p-4 rounded-lg inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupUri)}`}
                  alt="TOTP QR Code"
                  width={200}
                  height={200}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totpCode">Enter verification code:</Label>
              <div className="flex gap-2">
                <Input
                  id="totpCode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                />
                <Button onClick={handleVerify} disabled={loading || verifyCode.length !== 6}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Verify
                </Button>
              </div>
            </div>
          </div>
        )}

        {totpEnabled && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              2FA is active. Enter your password to disable it.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
              />
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={loading || !disablePassword}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldOff className="h-4 w-4 mr-2" />
                )}
                Disable
              </Button>
            </div>
          </div>
        )}

        {message && (
          <p className={message.type === "success" ? "text-sm text-green-600" : "text-sm text-destructive"}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
