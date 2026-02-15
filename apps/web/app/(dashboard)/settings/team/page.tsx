"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Trash2, Save, X } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  hasAvatar: boolean;
  createdAt: string;
}

interface TeamInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string };
}

interface TeamData {
  id: string;
  name: string;
  memberCount: number;
  members: TeamMember[];
}

export default function TeamPage() {
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    Promise.all([
      fetch("/api/team").then((r) => r.json()),
      isAdmin ? fetch("/api/team/invites").then((r) => r.json()) : Promise.resolve([]),
    ])
      .then(([teamData, inviteData]) => {
        setTeam(teamData);
        setTeamName(teamData.name);
        setInvites(inviteData);
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function handleSaveName() {
    if (!teamName.trim() || teamName.trim() === team?.name) return;
    setSavingName(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTeam((prev) => prev ? { ...prev, name: updated.name } : prev);
        setMessage({ type: "success", text: "Team name updated" });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error });
      }
    } finally {
      setSavingName(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInvites((prev) => [{ ...data, invitedBy: { name: session?.user?.name ?? "" } }, ...prev]);
        setInviteEmail("");
        setMessage({ type: "success", text: "Invite sent" });
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    await fetch(`/api/team/invites/${inviteId}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  async function handleChangeRole(memberId: string, newRole: string) {
    const res = await fetch(`/api/team/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTeam((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.id === memberId ? { ...m, role: updated.role } : m
              ),
            }
          : prev
      );
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this member from the team? This cannot be undone.")) return;
    const res = await fetch(`/api/team/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setTeam((prev) =>
        prev
          ? { ...prev, members: prev.members.filter((m) => m.id !== memberId), memberCount: prev.memberCount - 1 }
          : prev
      );
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Team</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!team) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Team</h1>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              {isAdmin ? (
                <div className="flex gap-2">
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={savingName || teamName.trim() === team.name}
                  >
                    {savingName ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              ) : (
                <p className="text-sm">{team.name}</p>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.name}
                        {member.id === session?.user?.id && (
                          <span className="text-muted-foreground ml-1">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && member.id !== session?.user?.id ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1 bg-background"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline">{member.role}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Invite Member</CardTitle>
              <CardDescription>Send an invitation to join the team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="border rounded px-3 text-sm bg-background"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Invite
                </Button>
              </div>

              {invites.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Pending Invites</Label>
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-2 rounded border text-sm"
                    >
                      <div>
                        <span>{invite.email}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {invite.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRevokeInvite(invite.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {message && (
                <p className={message.type === "success" ? "text-sm text-green-600" : "text-sm text-destructive"}>
                  {message.text}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
