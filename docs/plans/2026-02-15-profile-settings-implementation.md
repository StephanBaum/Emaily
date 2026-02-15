# Profile, Settings & Team Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full settings hub with profile, security, mailboxes, preferences, team management, notifications, and self-registration with domain-based team auto-detection.

**Architecture:** Incremental settings hub — schema first, then settings layout shell, then populate sections one by one. Sign-up flow built alongside team management. Notification system wired into existing AI and assignment flows. All new UI lives under `(dashboard)/settings/` with a sidebar nav layout.

**Tech Stack:** Next.js 15 (App Router), React 19, Prisma 6, Tailwind 4, shadcn/ui, NextAuth v5, `@emaily/security` for crypto, SWR for client-side data fetching.

**Design doc:** `docs/plans/2026-02-15-profile-settings-design.md`

---

## Task 1: Schema Migration — User, Mailbox, TeamInvite, Notification, Tag

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Add fields to User model in schema.prisma**

Find the User model and add after `updatedAt`:

```prisma
  avatar       Bytes?
  avatarMime   String?
  preferences  Json      @default("{}")
```

**Step 2: Add signature field to Mailbox model**

Find the Mailbox model and add after the last folder mapping field:

```prisma
  signature    String?
```

**Step 3: Add notifyRoles to Tag model**

Find the Tag model and add after `minTrustLevel`:

```prisma
  notifyRoles  String[]  @default([])
```

**Step 4: Add TeamInvite model**

Add after the MailboxAccess model:

```prisma
model TeamInvite {
  id          String    @id @default(cuid())
  teamId      String
  email       String
  role        String    @default("member")
  invitedById String
  token       String    @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())

  team      Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  invitedBy User @relation("invites_sent", fields: [invitedById], references: [id])

  @@index([email])
  @@index([token])
}
```

**Step 5: Add Notification model**

Add after TeamInvite:

```prisma
model Notification {
  id         String   @id @default(cuid())
  userId     String
  teamId     String
  type       String
  title      String
  message    String?
  targetType String?
  targetId   String?
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([userId, read])
  @@index([userId, createdAt])
}
```

**Step 6: Add reverse relations to User and Team models**

On the User model, add these relation fields:

```prisma
  invitesSent   TeamInvite[]    @relation("invites_sent")
  notifications Notification[]
```

On the Team model, add:

```prisma
  invites       TeamInvite[]
  notifications Notification[]
```

**Step 7: Add shared types to packages/shared**

Add to `packages/shared/src/types/index.ts`:

```typescript
// Preferences
export interface UserPreferences {
  theme: "light" | "dark" | "system";
  density: "compact" | "comfortable";
  dateFormat: "relative" | "absolute" | "iso";
  previewLines: number;
  notifications: {
    browser: boolean;
    sound: boolean;
    digestEmail: boolean;
  };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  density: "comfortable",
  dateFormat: "relative",
  previewLines: 2,
  notifications: {
    browser: true,
    sound: false,
    digestEmail: false,
  },
};

// Notifications
export type NotificationType = "ai_notify" | "assignment" | "mention" | "invite";

export interface Notification {
  id: string;
  userId: string;
  teamId: string;
  type: NotificationType;
  title: string;
  message: string | null;
  targetType: string | null;
  targetId: string | null;
  read: boolean;
  createdAt: Date;
}

// Team Invites
export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: string;
  invitedById: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}
```

**Step 8: Generate Prisma client and push schema**

Run: `cd packages/database && pnpm db:generate && pnpm db:push`
Expected: Schema pushed successfully, no errors.

**Step 9: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/shared/src/types/index.ts
git commit -m "feat: add schema for profile, notifications, team invites"
```

---

## Task 2: Settings Layout Shell

**Files:**
- Create: `apps/web/app/(dashboard)/settings/layout.tsx`
- Create: `apps/web/app/(dashboard)/settings/page.tsx`
- Create: `apps/web/components/settings/settings-sidebar.tsx`

**Step 1: Create the settings sidebar component**

Create `apps/web/components/settings/settings-sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, Mail, SlidersHorizontal, Users, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Profile", href: "/settings/profile", icon: User },
  { label: "Security", href: "/settings/security", icon: Shield },
  { label: "Mailboxes", href: "/settings/mailboxes", icon: Mail },
  { label: "Preferences", href: "/settings/preferences", icon: SlidersHorizontal },
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "AI Agents", href: "/settings/agents", icon: Bot },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 border-r bg-muted/30 p-4 space-y-1">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4 px-2">Settings</h2>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 2: Create the settings layout**

Create `apps/web/app/(dashboard)/settings/layout.tsx`:

```typescript
import { SettingsSidebar } from "@/components/settings/settings-sidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <SettingsSidebar />
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
```

**Step 3: Create the settings index redirect**

Create `apps/web/app/(dashboard)/settings/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/profile");
}
```

**Step 4: Verify it renders**

Run: `cd apps/web && pnpm dev`
Navigate to `/settings` — should redirect to `/settings/profile` (404 for now is fine, redirect is the test).

**Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/layout.tsx apps/web/app/\(dashboard\)/settings/page.tsx apps/web/components/settings/settings-sidebar.tsx
git commit -m "feat: add settings layout shell with sidebar navigation"
```

---

## Task 3: Profile Page — API Routes

**Files:**
- Create: `apps/web/app/api/user/profile/route.ts`
- Create: `apps/web/app/api/user/avatar/route.ts`
- Create: `apps/web/app/api/user/avatar/[userId]/route.ts`

**Step 1: Create profile update API**

Create `apps/web/app/api/user/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      createdAt: true,
      avatarMime: true,
      preferences: true,
      team: { select: { name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    teamName: user.team.name,
    hasAvatar: !!user.avatarMime,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json(user);
}
```

**Step 2: Create avatar upload/delete API**

Create `apps/web/app/api/user/avatar/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_AVATAR_SIZE = 200 * 1024; // 200KB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, mimeType } = body;

  if (!data || !mimeType) {
    return NextResponse.json(
      { error: "data and mimeType are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Invalid image type. Use PNG, JPEG, or WebP." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(data, "base64");

  if (buffer.length > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: "Image too large. Maximum size is 200KB." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar: buffer, avatarMime: mimeType },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar: null, avatarMime: null },
  });

  return NextResponse.json({ success: true });
}
```

**Step 3: Create avatar serving endpoint**

Create `apps/web/app/api/user/avatar/[userId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true, avatarMime: true },
  });

  if (!user?.avatar || !user.avatarMime) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  return new NextResponse(user.avatar, {
    headers: {
      "Content-Type": user.avatarMime,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
```

**Step 4: Commit**

```bash
git add apps/web/app/api/user/
git commit -m "feat: add profile and avatar API routes"
```

---

## Task 4: Profile Page — UI

**Files:**
- Create: `apps/web/app/(dashboard)/settings/profile/page.tsx`
- Create: `apps/web/components/settings/avatar-upload.tsx`

**Step 1: Create avatar upload component**

Create `apps/web/components/settings/avatar-upload.tsx`:

```typescript
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2 } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  userName: string;
  hasAvatar: boolean;
  onAvatarChange: () => void;
}

export function AvatarUpload({
  userId,
  userName,
  hasAvatar,
  onAvatarChange,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(
    hasAvatar ? `/api/user/avatar/${userId}?t=${Date.now()}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const resized = await resizeImage(file, 200, 200);
      const res = await fetch("/api/user/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: resized.base64,
          mimeType: resized.mimeType,
        }),
      });

      if (res.ok) {
        setAvatarUrl(`/api/user/avatar/${userId}?t=${Date.now()}`);
        onAvatarChange();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      if (res.ok) {
        setAvatarUrl(null);
        onAvatarChange();
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-20 w-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload
        </Button>
        {avatarUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Remove
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}

async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, 0.85);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
```

**Step 2: Create profile page**

Create `apps/web/app/(dashboard)/settings/profile/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
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
              onAvatarChange={() => {
                setProfile((prev) => prev ? { ...prev, hasAvatar: true } : prev);
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
      </div>
    </div>
  );
}
```

**Step 3: Verify it renders**

Run: `cd apps/web && pnpm dev`
Navigate to `/settings/profile` — should show the profile page with avatar, name input, and account info.

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/profile/ apps/web/components/settings/avatar-upload.tsx
git commit -m "feat: add profile settings page with avatar upload"
```

---

## Task 5: Security Page — API Routes

**Files:**
- Create: `apps/web/app/api/user/password/route.ts`
- Create: `apps/web/app/api/user/totp/setup/route.ts`
- Create: `apps/web/app/api/user/totp/enable/route.ts`
- Create: `apps/web/app/api/user/totp/route.ts`

**Step 1: Create password change API**

Create `apps/web/app/api/user/password/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, validatePasswordStrength } from "@emaily/security";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new passwords are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return NextResponse.json(
      { error: "Password too weak", details: strength.errors },
      { status: 400 }
    );
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Create TOTP setup API**

Create `apps/web/app/api/user/totp/setup/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, generateTotpUri } from "@emaily/security";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.totpEnabled) {
    return NextResponse.json(
      { error: "2FA is already enabled" },
      { status: 400 }
    );
  }

  const secret = generateTotpSecret();
  const uri = generateTotpUri(secret, user.email, "Emaily");

  // Store secret temporarily (not enabled yet)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret },
  });

  return NextResponse.json({ secret, uri });
}
```

**Step 3: Create TOTP enable API**

Create `apps/web/app/api/user/totp/enable/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotpToken } from "@emaily/security";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;

  if (!code) {
    return NextResponse.json(
      { error: "Verification code is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpSecret) {
    return NextResponse.json(
      { error: "Run setup first" },
      { status: 400 }
    );
  }

  if (user.totpEnabled) {
    return NextResponse.json(
      { error: "2FA is already enabled" },
      { status: 400 }
    );
  }

  const isValid = verifyTotpToken(user.totpSecret, code);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid code. Try again." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpEnabled: true },
  });

  return NextResponse.json({ success: true });
}
```

**Step 4: Create TOTP disable API**

Create `apps/web/app/api/user/totp/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@emaily/security";

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { password } = body;

  if (!password) {
    return NextResponse.json(
      { error: "Password is required to disable 2FA" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, totpEnabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.totpEnabled) {
    return NextResponse.json(
      { error: "2FA is not enabled" },
      { status: 400 }
    );
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "Incorrect password" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpEnabled: false, totpSecret: null },
  });

  return NextResponse.json({ success: true });
}
```

**Step 5: Commit**

```bash
git add apps/web/app/api/user/password/ apps/web/app/api/user/totp/
git commit -m "feat: add password change and TOTP management API routes"
```

---

## Task 6: Security Page — UI

**Files:**
- Create: `apps/web/app/(dashboard)/settings/security/page.tsx`

**Step 1: Create security page**

Create `apps/web/app/(dashboard)/settings/security/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldOff } from "lucide-react";

export default function SecurityPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Security</h1>
      <div className="space-y-6">
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
        // Check if user has TOTP by fetching profile
        // We'll need to add totpEnabled to profile response
        setTotpEnabled(false); // Default, updated after fetch
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
```

**Step 2: Add totpEnabled to profile API response**

In `apps/web/app/api/user/profile/route.ts`, add `totpEnabled: true` to the `select` object in the GET handler. Then include it in the response.

**Step 3: Verify it renders**

Run dev server and navigate to `/settings/security`. Should show password change form and 2FA setup button.

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/security/ apps/web/app/api/user/profile/route.ts
git commit -m "feat: add security settings page with password and 2FA management"
```

---

## Task 7: Preferences Page — Context Provider + API + UI

**Files:**
- Create: `apps/web/contexts/preferences-context.tsx`
- Create: `apps/web/app/api/user/preferences/route.ts`
- Create: `apps/web/app/(dashboard)/settings/preferences/page.tsx`
- Modify: `apps/web/app/(dashboard)/layout.tsx`

**Step 1: Create preferences context**

Create `apps/web/contexts/preferences-context.tsx`:

```typescript
"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { UserPreferences } from "@emaily/shared";
import { DEFAULT_PREFERENCES } from "@emaily/shared";

interface PreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: async () => {},
  isLoading: true,
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((res) => res.json())
      .then((data) => {
        setPreferences({ ...DEFAULT_PREFERENCES, ...data });
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === "dark") {
      root.classList.add("dark");
    } else if (preferences.theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
    }
  }, [preferences.theme]);

  // Apply density
  useEffect(() => {
    document.documentElement.dataset.density = preferences.density;
  }, [preferences.density]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const merged = { ...preferences, ...updates };
    setPreferences(merged);

    await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
    });
  }, [preferences]);

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, isLoading }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
```

**Step 2: Create preferences API**

Create `apps/web/app/api/user/preferences/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });

  return NextResponse.json(user?.preferences ?? {});
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferences: body },
  });

  return NextResponse.json({ success: true });
}
```

**Step 3: Create preferences page**

Create `apps/web/app/(dashboard)/settings/preferences/page.tsx`:

```typescript
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
```

**Step 4: Wire PreferencesProvider into dashboard layout**

In `apps/web/app/(dashboard)/layout.tsx`, import `PreferencesProvider` from `@/contexts/preferences-context` and wrap children with it (inside SessionProvider, alongside ThreadUpdatesProvider).

**Step 5: Verify**

Navigate to `/settings/preferences`. Theme toggle should switch between light/dark/system immediately.

**Step 6: Commit**

```bash
git add apps/web/contexts/preferences-context.tsx apps/web/app/api/user/preferences/ apps/web/app/\(dashboard\)/settings/preferences/ apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat: add preferences page with theme, density, and notification settings"
```

---

## Task 8: Mailbox Management — API Routes

**Files:**
- Create: `apps/web/app/api/mailboxes/[id]/route.ts`
- Create: `apps/web/app/api/mailboxes/test-connection/route.ts`
- Create: `apps/web/app/api/mailboxes/[id]/access/route.ts`
- Modify: `apps/web/app/api/mailboxes/route.ts` (extend existing GET, add POST)

**Step 1: Extend mailboxes list endpoint and add POST**

Read the existing `apps/web/app/api/mailboxes/route.ts` and extend:
- GET: Add `signature`, `imapHost`, `smtpHost`, `displayName`, `type` to the select
- POST: Create new mailbox with IMAP/SMTP config. Encrypt passwords using `encrypt()` from `@emaily/security`. Auto-create `MailboxAccess` for the creating user with `admin` permission. Validate required fields.

**Step 2: Create single mailbox PATCH/DELETE**

Create `apps/web/app/api/mailboxes/[id]/route.ts`:
- GET: Return full mailbox details (for edit form) — verify user has access
- PATCH: Update mailbox fields — verify user has `admin` permission on this mailbox. Re-encrypt password if changed.
- DELETE: Remove mailbox — verify user has `admin` permission. Cascade deletes access records.

**Step 3: Create test-connection endpoint**

Create `apps/web/app/api/mailboxes/test-connection/route.ts`:
- POST: Accept IMAP and SMTP config. Use `ImapClient` from `@emaily/mail-engine` to test IMAP connection (connect, list folders, disconnect). Use `SmtpClient` to verify SMTP. Return `{ imap: { success, folders?, error? }, smtp: { success, error? } }`.

**Step 4: Create access management endpoints**

Create `apps/web/app/api/mailboxes/[id]/access/route.ts`:
- GET: List all `MailboxAccess` entries for this mailbox with user details. Admin-only.
- POST: Grant access to a team member. Validate user is in same team. Admin-only.
- We'll handle PATCH/DELETE for individual access records in the same file using query params or a sub-route.

**Step 5: Commit**

```bash
git add apps/web/app/api/mailboxes/
git commit -m "feat: add mailbox CRUD, test-connection, and access management APIs"
```

---

## Task 9: Mailbox Management — UI

**Files:**
- Create: `apps/web/app/(dashboard)/settings/mailboxes/page.tsx`
- Create: `apps/web/components/settings/mailbox-form.tsx`

**Step 1: Create mailbox form component**

Create `apps/web/components/settings/mailbox-form.tsx`:
- Form with sections: General (email, displayName, type), IMAP (host, port, user, password), SMTP (host, port, user, password), Signature (textarea)
- "Test Connection" button that calls `/api/mailboxes/test-connection` and shows results
- Folder mapping section: after successful IMAP test, show detected folders with dropdowns for inbox/archive/trash/drafts/sent/spam mapping
- Submit calls POST (create) or PATCH (edit) depending on mode
- Cancel button

**Step 2: Create mailboxes page**

Create `apps/web/app/(dashboard)/settings/mailboxes/page.tsx`:
- List view: Cards for each mailbox with email, type badge, host info
- "Add Mailbox" button opens form
- Edit button on each card opens form pre-filled
- Delete button with confirmation dialog
- For shared mailboxes: expandable "Access" section showing team members with permission dropdowns

**Step 3: Verify**

Navigate to `/settings/mailboxes`. Should show existing mailboxes and allow adding new ones.

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/mailboxes/ apps/web/components/settings/mailbox-form.tsx
git commit -m "feat: add mailbox management settings page"
```

---

## Task 10: Notification System — Model, Service, API

**Files:**
- Create: `apps/web/lib/services/notification-service.ts`
- Create: `apps/web/app/api/notifications/route.ts`
- Create: `apps/web/app/api/notifications/[id]/route.ts`
- Create: `apps/web/app/api/notifications/mark-all-read/route.ts`

**Step 1: Create notification service**

Create `apps/web/lib/services/notification-service.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function createNotification({
  userId,
  teamId,
  type,
  title,
  message,
  targetType,
  targetId,
}: {
  userId: string;
  teamId: string;
  type: string;
  title: string;
  message?: string;
  targetType?: string;
  targetId?: string;
}) {
  return prisma.notification.create({
    data: { userId, teamId, type, title, message, targetType, targetId },
  });
}

export async function createNotificationsForTeam({
  teamId,
  mailboxId,
  excludeUserId,
  type,
  title,
  message,
  targetType,
  targetId,
  roles,
}: {
  teamId: string;
  mailboxId?: string;
  excludeUserId?: string;
  type: string;
  title: string;
  message?: string;
  targetType?: string;
  targetId?: string;
  roles?: string[];
}) {
  // Find team members who have access to the mailbox
  let userIds: string[];

  if (mailboxId) {
    const accessRecords = await prisma.mailboxAccess.findMany({
      where: { mailboxId },
      select: { userId: true, user: { select: { role: true } } },
    });

    userIds = accessRecords
      .filter((a) => !roles?.length || roles.includes(a.user.role))
      .map((a) => a.userId);
  } else {
    const users = await prisma.user.findMany({
      where: {
        teamId,
        ...(roles?.length ? { role: { in: roles } } : {}),
      },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  }

  // Exclude the triggering user
  if (excludeUserId) {
    userIds = userIds.filter((id) => id !== excludeUserId);
  }

  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      teamId,
      type,
      title,
      message,
      targetType,
      targetId,
    })),
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}
```

**Step 2: Create notifications list API**

Create `apps/web/app/api/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const cursor = searchParams.get("cursor");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > limit;
  if (hasMore) notifications.pop();

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return NextResponse.json({
    notifications,
    unreadCount,
    hasMore,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
  });
}
```

**Step 3: Create mark-as-read endpoints**

Create `apps/web/app/api/notifications/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
```

Create `apps/web/app/api/notifications/mark-all-read/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
```

**Step 4: Commit**

```bash
git add apps/web/lib/services/notification-service.ts apps/web/app/api/notifications/
git commit -m "feat: add notification service and API routes"
```

---

## Task 11: Notification System — UI (Bell Icon + Dropdown)

**Files:**
- Create: `apps/web/components/notifications/notification-bell.tsx`
- Create: `apps/web/hooks/use-notifications.ts`
- Modify: `apps/web/components/inbox/sidebar.tsx`

**Step 1: Create notifications SWR hook**

Create `apps/web/hooks/use-notifications.ts`:

```typescript
"use client";

import useSWR from "swr";
import { fetcher, realtimeConfig } from "@/lib/swr-config";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string | null;
  targetType: string | null;
  targetId: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationData[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    "/api/notifications",
    fetcher<NotificationsResponse>,
    realtimeConfig
  );

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    isError: error,
    mutate,
  };
}
```

**Step 2: Create notification bell component**

Create `apps/web/components/notifications/notification-bell.tsx`:

Component with:
- Bell icon button with unread count badge (red dot or number)
- Click opens a popover/dropdown panel
- Panel shows list of notifications with: icon by type, title, message, relative time, read/unread styling
- "Mark all as read" button at top
- Click on notification: mark as read, navigate to target (e.g., `/thread/[targetId]`)
- Uses `useNotifications()` hook
- Calls `PATCH /api/notifications/[id]` on click, `POST /api/notifications/mark-all-read` for bulk

**Step 3: Add notification bell to sidebar**

In `apps/web/components/inbox/sidebar.tsx`, add the `<NotificationBell />` component near the user menu section at the bottom of the sidebar.

**Step 4: Verify**

Navigate to the app. Bell icon should appear in sidebar. No notifications yet (empty state).

**Step 5: Commit**

```bash
git add apps/web/components/notifications/ apps/web/hooks/use-notifications.ts apps/web/components/inbox/sidebar.tsx
git commit -m "feat: add notification bell with dropdown in sidebar"
```

---

## Task 12: Wire Notifications into Existing Features

**Files:**
- Modify: `apps/web/lib/ai.ts` — wire notify tag action
- Modify: `apps/web/app/api/threads/[id]/assignments/route.ts` — notify on assign

**Step 1: Wire AI notify action**

In `apps/web/lib/ai.ts`, find the `case "notify":` block. Replace the placeholder with:

```typescript
case "notify": {
  if (executedActionKeys.has(`ai_notified:${tag.name}`)) break;

  const { createNotificationsForTeam } = await import("@/lib/services/notification-service");

  await createNotificationsForTeam({
    teamId,
    mailboxId: thread.mailboxId,
    type: "ai_notify",
    title: `AI flagged: ${thread.subject}`,
    message: `Tagged with "${tag.name}"`,
    targetType: "thread",
    targetId: threadId,
    roles: tag.notifyRoles?.length ? tag.notifyRoles : undefined,
  });

  result.actionsExecuted.push({
    action: "notify",
    tagId: tag.id,
    tagName: tag.name,
  });
  await logAIActivity(teamId, threadId, "ai_notified", {
    tagName: tag.name,
  });
  break;
}
```

**Step 2: Wire assignment notifications**

In `apps/web/app/api/threads/[id]/assignments/route.ts`, in the POST handler, after creating the assignment, add:

```typescript
// Notify assignee
if (assignedToId !== session.user.id) {
  const { createNotification } = await import("@/lib/services/notification-service");
  await createNotification({
    userId: assignedToId,
    teamId: thread.mailbox.teamId,
    type: "assignment",
    title: `Assigned to you: ${thread.subject}`,
    message: `By ${session.user.name}`,
    targetType: "thread",
    targetId: threadId,
  });
}
```

**Step 3: Verify**

Create an assignment — assignee should see a notification in the bell.

**Step 4: Commit**

```bash
git add apps/web/lib/ai.ts apps/web/app/api/threads/\[id\]/assignments/route.ts
git commit -m "feat: wire notifications into AI notify action and assignments"
```

---

## Task 13: Team Management — API Routes

**Files:**
- Create: `apps/web/app/api/team/route.ts`
- Create: `apps/web/app/api/team/invites/route.ts`
- Create: `apps/web/app/api/team/invites/[id]/route.ts`
- Create: `apps/web/app/api/team/members/[id]/route.ts`

**Step 1: Create team info/update API**

Create `apps/web/app/api/team/route.ts`:
- GET: Return team info (name, member count)
- PATCH: Update team name (admin only)

**Step 2: Create team invites API**

Create `apps/web/app/api/team/invites/route.ts`:
- GET: List pending invites (admin only). Filter to `acceptedAt: null, expiresAt: { gt: now }`.
- POST: Create invite. Admin only. Generate secure token via `generateSecureId()` from `@emaily/security`. Set expiry to 7 days. Validate email not already a team member.

Create `apps/web/app/api/team/invites/[id]/route.ts`:
- DELETE: Revoke invite (admin only). Delete the record.

**Step 3: Create team member management API**

Create `apps/web/app/api/team/members/[id]/route.ts`:
- PATCH: Change member role (admin only). Cannot change own role. Validate target is in same team.
- DELETE: Remove member from team (admin only). Cannot remove self. Dissociate from team (or delete — discuss in implementation).

**Step 4: Commit**

```bash
git add apps/web/app/api/team/
git commit -m "feat: add team management API routes (invites, roles, members)"
```

---

## Task 14: Team Management — UI

**Files:**
- Create: `apps/web/app/(dashboard)/settings/team/page.tsx`

**Step 1: Create team settings page**

Create `apps/web/app/(dashboard)/settings/team/page.tsx`:

Component with:
- Team name display (editable for admins, inline edit with save)
- Member list: table/cards with avatar, name, email, role badge, joined date
- Admin controls:
  - Role dropdown per member (admin/member) — calls `PATCH /api/team/members/[id]`
  - Remove button per member (with confirmation dialog) — calls `DELETE /api/team/members/[id]`
  - "Invite Member" section: email input + role select + invite button
  - Pending invites list with email, role, expires, revoke button
- Non-admin view: read-only member list, no invite/role controls

**Step 2: Verify**

Navigate to `/settings/team`. Should show team members. Admin should see invite controls.

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/team/
git commit -m "feat: add team management settings page"
```

---

## Task 15: Self-Registration Flow

**Files:**
- Create: `apps/web/app/(auth)/register/page.tsx`
- Create: `apps/web/components/auth/register-form.tsx`
- Create: `apps/web/app/api/auth/register/route.ts`
- Create: `apps/web/app/api/auth/check-domain/route.ts`

**Step 1: Create domain check API**

Create `apps/web/app/api/auth/check-domain/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const domain = email.split("@")[1].toLowerCase();

  // Find teams where any user has the same domain
  const usersWithDomain = await prisma.user.findMany({
    where: {
      email: { endsWith: `@${domain}` },
    },
    select: {
      team: { select: { id: true, name: true } },
    },
    take: 1,
  });

  if (usersWithDomain.length > 0) {
    const team = usersWithDomain[0].team;
    return NextResponse.json({ teamFound: true, teamName: team.name, teamId: team.id });
  }

  // Suggest team name from domain
  const teamName = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
  return NextResponse.json({ teamFound: false, suggestedName: teamName });
}
```

**Step 2: Create registration API**

Create `apps/web/app/api/auth/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@emaily/security";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password, teamId, newTeamName } = body;

  // Validate inputs
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return NextResponse.json(
      { error: "Password too weak", details: strength.errors },
      { status: 400 }
    );
  }

  // Check if email already registered
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  if (teamId) {
    // Joining existing team — create user and grant read access to shared mailboxes
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
        role: "member",
        teamId,
      },
    });

    // Auto-grant read access to shared mailboxes
    const sharedMailboxes = await prisma.mailbox.findMany({
      where: { teamId, type: "shared" },
      select: { id: true },
    });

    if (sharedMailboxes.length > 0) {
      await prisma.mailboxAccess.createMany({
        data: sharedMailboxes.map((m) => ({
          userId: user.id,
          mailboxId: m.id,
          permission: "read",
        })),
      });
    }

    return NextResponse.json({ userId: user.id, teamId }, { status: 201 });
  } else {
    // Creating new team
    const teamName = newTeamName?.trim() || email.split("@")[1].split(".")[0];

    const team = await prisma.team.create({
      data: { name: teamName },
    });

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
        role: "admin",
        teamId: team.id,
      },
    });

    return NextResponse.json({ userId: user.id, teamId: team.id }, { status: 201 });
  }
}
```

**Step 3: Create registration form component**

Create `apps/web/components/auth/register-form.tsx`:

Multi-step form:
1. Step 1: Name, email, password (with strength indicator), confirm password
2. On email blur or submit: call `/api/auth/check-domain` to check for existing team
3. Step 2: Show team detection result
   - If team found: "Join **TeamName**?" with Join button
   - If no team: "Create team **SuggestedName**?" with editable name and Create button
4. On submit: call `POST /api/auth/register`
5. On success: auto-sign-in via `signIn("credentials", ...)` and redirect to `/settings/mailboxes`

**Step 4: Create registration page**

Create `apps/web/app/(auth)/register/page.tsx`:

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/register-form";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Sign up to start managing your email with Emaily.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 5: Add link to registration from login page**

In `apps/web/components/auth/login-form.tsx`, add a "Don't have an account? Sign up" link at the bottom pointing to `/register`.

**Step 6: Verify**

Navigate to `/register`. Fill in the form. Domain check should fire on email input. Team detection should work.

**Step 7: Commit**

```bash
git add apps/web/app/\(auth\)/register/ apps/web/components/auth/register-form.tsx apps/web/app/api/auth/ apps/web/components/auth/login-form.tsx
git commit -m "feat: add self-registration with domain-based team detection"
```

---

## Task 16: Move Agents Page into Settings Layout

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/agents/page.tsx`

**Step 1: Update agents page**

The existing agents page at `apps/web/app/(dashboard)/settings/agents/page.tsx` is already in the right location. It should work with the new settings layout automatically since `layout.tsx` wraps all children under `settings/`.

Verify the page renders correctly within the new sidebar layout. If the page has its own padding/wrapper that conflicts with the settings layout, adjust it to remove redundant padding.

**Step 2: Verify**

Navigate to `/settings/agents`. Should render within the settings sidebar layout.

**Step 3: Commit (if changes needed)**

```bash
git add apps/web/app/\(dashboard\)/settings/agents/
git commit -m "refactor: adapt agents page to settings layout"
```

---

## Task 17: Add Settings Link to Sidebar

**Files:**
- Modify: `apps/web/components/inbox/sidebar.tsx`

**Step 1: Add settings gear icon**

In the sidebar's user menu section (bottom), add a Settings link/icon that navigates to `/settings`. Use the `Settings` icon from lucide-react.

**Step 2: Verify**

Click the settings icon in the sidebar. Should navigate to `/settings/profile`.

**Step 3: Commit**

```bash
git add apps/web/components/inbox/sidebar.tsx
git commit -m "feat: add settings navigation link to sidebar"
```

---

## Task 18: Build & Lint Check

**Step 1: Run the full build**

Run: `pnpm build`
Expected: All packages build successfully.

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No lint errors.

**Step 3: Run tests**

Run: `pnpm test`
Expected: All existing tests pass (93+).

**Step 4: Fix any issues found**

Address build errors, lint warnings, or test failures.

**Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve build and lint issues from settings implementation"
```

---

## Task 19: Update Progress Documentation

**Files:**
- Modify: `docs/progress.md`

**Step 1: Update progress**

Add an entry documenting the settings hub implementation:
- What was built (profile, security, mailboxes, preferences, team, notifications, sign-up)
- Files touched
- Related commits

**Step 2: Commit**

```bash
git add docs/progress.md
git commit -m "docs: update progress with settings hub implementation"
```
