"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Users, Plus } from "lucide-react";

interface DomainCheck {
  teamFound: boolean;
  teamName?: string;
  teamId?: string;
  suggestedName?: string;
}

export function RegisterForm() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [domainCheck, setDomainCheck] = useState<DomainCheck | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [error, setError] = useState("");

  async function checkDomain(emailValue: string) {
    if (!emailValue.includes("@")) return;
    setCheckingDomain(true);
    try {
      const res = await fetch("/api/auth/check-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      const data = await res.json();
      setDomainCheck(data);
      if (!data.teamFound) {
        setNewTeamName(data.suggestedName || "");
      }
    } finally {
      setCheckingDomain(false);
    }
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setStep(2);
  }

  async function handleRegister(teamId?: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          teamId,
          newTeamName: teamId ? undefined : newTeamName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Auto sign in
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        // New team creators go through onboarding; joiners go straight to inbox
        window.location.href = teamId ? "/inbox" : "/onboarding";
      } else {
        setError("Account created but sign-in failed. Please log in manually.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === 1) {
    return (
      <form onSubmit={handleStep1Submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => checkDomain(e.target.value)}
            placeholder="you@company.com"
            required
          />
          {checkingDomain && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking team...
            </p>
          )}
          {domainCheck && (
            <p className="text-xs text-muted-foreground">
              {domainCheck.teamFound
                ? `Team "${domainCheck.teamName}" found for your domain`
                : "No existing team for your domain"}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            required
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => setStep(1)} className="text-xs">
        Back
      </Button>

      {domainCheck?.teamFound ? (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Join {domainCheck.teamName}?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your domain matches an existing team.
            </p>
          </div>
          <Button
            onClick={() => handleRegister(domainCheck.teamId)}
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Join Team
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Create a new team instead</Label>
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
            />
            <Button
              variant="outline"
              onClick={() => handleRegister()}
              disabled={loading || !newTeamName.trim()}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Plus className="h-4 w-4 mr-2" />
              Create New Team
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 text-center">
            <Plus className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Create Your Team</p>
            <p className="text-sm text-muted-foreground mt-1">
              No existing team for your domain. Create one now.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Team Name</Label>
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={() => handleRegister()}
            disabled={loading || !newTeamName.trim()}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Team & Sign Up
          </Button>
        </div>
      )}
    </div>
  );
}
