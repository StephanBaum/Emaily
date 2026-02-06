# Collaborative AI Email Client - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a modern, collaborative email client with AI-powered automation for a small team, replacing Gmail as a client for self-hosted mail servers.

**Architecture:** Next.js monorepo with isolated workers for IMAP sync and AI processing. PostgreSQL with pgvector for storage and semantic search. BullMQ + Redis for job queuing. Local AI via Ollama.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind, shadcn/ui, Prisma, PostgreSQL + pgvector, Redis, BullMQ, Socket.io, Ollama, Docker

---

## Phase Overview

| Phase | Focus | Duration Estimate |
|-------|-------|-------------------|
| 1 | Project Setup & Infrastructure | Foundation |
| 2 | Database Schema & Core Models | Data layer |
| 3 | Authentication & Security | Auth system |
| 4 | Mail Engine (IMAP/SMTP) | Email basics |
| 5 | Core UI - Inbox & Threads | User interface |
| 6 | Collaboration Features | Team features |
| 7 | AI Integration | Smart features |
| 8 | Polish & Production | Launch prep |

---

# Phase 1: Project Setup & Infrastructure

## Task 1.1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Initialize pnpm workspace**

```bash
pnpm init
```

**Step 2: Create workspace configuration**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "workers/*"
```

**Step 3: Create turbo configuration**

Create `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Step 4: Create .gitignore**

Create `.gitignore`:
```
# Dependencies
node_modules
.pnpm-store

# Build
.next
dist
.turbo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea
.vscode
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage
.nyc_output

# Database
*.db
*.sqlite
```

**Step 5: Create .nvmrc**

Create `.nvmrc`:
```
20
```

**Step 6: Update package.json**

```json
{
  "name": "emailautomation",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:watch": "turbo test:watch"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

**Step 7: Install turbo**

```bash
pnpm add -D turbo
```

**Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: initialize pnpm monorepo with turbo"
```

---

## Task 1.2: Create Next.js Web App

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`

**Step 1: Create apps/web directory and initialize**

```bash
mkdir -p apps/web
cd apps/web
pnpm init
```

**Step 2: Install Next.js dependencies**

```bash
pnpm add next@14 react react-dom
pnpm add -D typescript @types/react @types/react-dom @types/node
pnpm add -D tailwindcss postcss autoprefixer
pnpm add -D eslint eslint-config-next
```

**Step 3: Create package.json**

Update `apps/web/package.json`:
```json
{
  "name": "@emailautomation/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 4: Create next.config.js**

Create `apps/web/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@emailautomation/database",
    "@emailautomation/shared",
  ],
};

module.exports = nextConfig;
```

**Step 5: Create tsconfig.json**

Create `apps/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@emailautomation/database": ["../../packages/database/src"],
      "@emailautomation/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 6: Create tailwind.config.ts**

Create `apps/web/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 7: Create postcss.config.js**

Create `apps/web/postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 8: Create globals.css**

Create `apps/web/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 9: Create layout.tsx**

Create `apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Email Automation",
  description: "Collaborative AI-powered email client",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Step 10: Create page.tsx**

Create `apps/web/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Email Automation</h1>
      <p className="mt-4 text-muted-foreground">
        Collaborative AI-powered email client
      </p>
    </main>
  );
}
```

**Step 11: Verify dev server starts**

```bash
cd apps/web
pnpm dev
```

Expected: Server starts on http://localhost:3000, page renders

**Step 12: Commit**

```bash
git add .
git commit -m "feat: add Next.js web app with Tailwind"
```

---

## Task 1.3: Create Shared Packages

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`

**Step 1: Create shared package**

```bash
mkdir -p packages/shared/src/types
```

**Step 2: Create packages/shared/package.json**

```json
{
  "name": "@emailautomation/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "test": "vitest",
    "test:watch": "vitest --watch"
  }
}
```

**Step 3: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create packages/shared/src/types/index.ts**

```typescript
// User & Team types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mailbox types
export type MailboxType = "personal" | "shared";
export type MailboxPermission = "read" | "write" | "admin";

export interface Mailbox {
  id: string;
  emailAddress: string;
  type: MailboxType;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Thread & Email types
export type ThreadStatus = "open" | "archived" | "snoozed";
export type AssignmentStatus = "open" | "in_progress" | "done";

export interface Thread {
  id: string;
  mailboxId: string;
  teamId: string;
  subject: string;
  status: ThreadStatus;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Email {
  id: string;
  threadId: string;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  imapUid: number | null;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date: Date;
  folder: string;
  isDraft: boolean;
  isSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tag types
export type TagAiAction = "none" | "draft" | "research_draft" | "auto_reply" | "archive" | "notify";
export type TagAppliedBy = "manual" | "auto" | "ai";

export interface Tag {
  id: string;
  teamId: string;
  name: string;
  color: string;
  aiAction: TagAiAction;
  createdAt: Date;
  updatedAt: Date;
}

// AI types
export interface EmailIntent {
  type: "question" | "request" | "info";
  text: string;
  priority: number;
}

export interface DraftConfidence {
  overall: number;
  intentCoverage: number;
  qaMatchStrength: number;
  ragRelevance: number;
  toneConsistency: number;
}

// Activity types
export type ActivityAction =
  | "login"
  | "logout"
  | "email_read"
  | "email_sent"
  | "assigned"
  | "tagged"
  | "commented"
  | "archived"
  | "draft_created"
  | "draft_sent";

export interface ActivityLog {
  id: string;
  teamId: string;
  userId: string;
  action: ActivityAction;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}
```

**Step 5: Create packages/shared/src/index.ts**

```typescript
export * from "./types";
```

**Step 6: Create database package directory**

```bash
mkdir -p packages/database
```

**Step 7: Create packages/database/package.json**

```json
{
  "name": "@emailautomation/database",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "lint": "eslint src/",
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0"
  }
}
```

**Step 8: Create packages/database/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 9: Install dependencies from root**

```bash
cd ../..
pnpm install
```

**Step 10: Commit**

```bash
git add .
git commit -m "feat: add shared types and database packages"
```

---

## Task 1.4: Docker Development Environment

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/.env.example`
- Create: `.env.example`

**Step 1: Create docker directory**

```bash
mkdir -p docker
```

**Step 2: Create docker-compose.yml**

Create `docker/docker-compose.yml`:
```yaml
version: "3.8"

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: emailautomation-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-emailautomation}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-emailautomation}
      POSTGRES_DB: ${POSTGRES_DB:-emailautomation}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-emailautomation}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: emailautomation-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    container_name: emailautomation-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    # Remove 'deploy' section if no GPU available

  greenmail:
    image: greenmail/standalone:2.0.0
    container_name: emailautomation-greenmail
    ports:
      - "3025:3025"   # SMTP
      - "3110:3110"   # POP3
      - "3143:3143"   # IMAP
      - "3465:3465"   # SMTPS
      - "3993:3993"   # IMAPS
      - "3995:3995"   # POP3S
    environment:
      - GREENMAIL_OPTS=-Dgreenmail.setup.test.all -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.users=test:test@localhost.com

volumes:
  postgres_data:
  redis_data:
  ollama_data:
```

**Step 3: Create docker/.env.example**

Create `docker/.env.example`:
```env
# PostgreSQL
POSTGRES_USER=emailautomation
POSTGRES_PASSWORD=emailautomation
POSTGRES_DB=emailautomation

# Redis
REDIS_URL=redis://localhost:6379

# Ollama
OLLAMA_HOST=http://localhost:11434
```

**Step 4: Create root .env.example**

Create `.env.example`:
```env
# Database
DATABASE_URL="postgresql://emailautomation:emailautomation@localhost:5432/emailautomation?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Ollama
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="llama3"

# Auth
NEXTAUTH_SECRET="your-secret-here-generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Encryption
MASTER_ENCRYPTION_KEY="your-32-byte-key-here"

# Mail (for testing with GreenMail)
TEST_IMAP_HOST="localhost"
TEST_IMAP_PORT="3143"
TEST_SMTP_HOST="localhost"
TEST_SMTP_PORT="3025"
TEST_MAIL_USER="test"
TEST_MAIL_PASSWORD="test"
```

**Step 5: Add script to root package.json**

Update root `package.json`:
```json
{
  "name": "emailautomation",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:watch": "turbo test:watch",
    "docker:up": "docker-compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker-compose -f docker/docker-compose.yml down",
    "docker:logs": "docker-compose -f docker/docker-compose.yml logs -f"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

**Step 6: Test Docker setup**

```bash
pnpm docker:up
```

Expected: All containers start successfully

**Step 7: Verify services**

```bash
docker ps
```

Expected: postgres, redis, ollama, greenmail all running

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add Docker development environment"
```

---

## Task 1.5: Setup Testing Framework

**Files:**
- Create: `vitest.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `packages/shared/vitest.config.ts`

**Step 1: Install vitest at root**

```bash
pnpm add -D vitest @vitest/coverage-v8 -w
```

**Step 2: Create root vitest.config.ts**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

**Step 3: Create apps/web/vitest.config.ts**

Create `apps/web/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

**Step 4: Install web app test dependencies**

```bash
cd apps/web
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 5: Create test setup file**

Create `apps/web/tests/setup.ts`:
```typescript
import "@testing-library/jest-dom";
```

**Step 6: Create a sample test**

Create `apps/web/tests/page.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "../app/page";

describe("Home", () => {
  it("renders the heading", () => {
    render(<Home />);
    expect(screen.getByText("Email Automation")).toBeInTheDocument();
  });
});
```

**Step 7: Run tests to verify setup**

```bash
pnpm test
```

Expected: 1 test passes

**Step 8: Create packages/shared/vitest.config.ts**

Create `packages/shared/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 9: Commit**

```bash
cd ../..
git add .
git commit -m "feat: add Vitest testing framework"
```

---

# Phase 2: Database Schema & Core Models

## Task 2.1: Prisma Schema - Core Entities

**Files:**
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/src/index.ts`
- Create: `packages/database/src/client.ts`

**Step 1: Install Prisma in database package**

```bash
cd packages/database
pnpm add @prisma/client
pnpm add -D prisma
pnpm prisma init
```

**Step 2: Create Prisma schema**

Create `packages/database/prisma/schema.prisma`:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgcrypto, vector]
}

// ============================================
// USERS & TEAMS
// ============================================

model Team {
  id        String   @id @default(cuid())
  name      String
  settings  Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users     User[]
  mailboxes Mailbox[]
  tags      Tag[]
  contacts  Contact[]
  qaPairs   QAPair[]
  activities ActivityLog[]

  @@map("teams")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String   @map("password_hash")
  totpSecret   String?  @map("totp_secret")
  totpEnabled  Boolean  @default(false) @map("totp_enabled")
  role         String   @default("member") // admin, member
  teamId       String   @map("team_id")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  team           Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  mailboxAccess  MailboxAccess[]
  comments       Comment[]
  assignedTo     Assignment[]     @relation("assigned_to")
  assignedBy     Assignment[]     @relation("assigned_by")
  seenBy         SeenBy[]
  sharedDrafts   SharedDraft[]
  draftVersions  DraftVersion[]
  activities     ActivityLog[]
  refreshTokens  RefreshToken[]

  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash")
  familyId  String   @map("family_id")
  used      Boolean  @default(false)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
  @@index([familyId])
  @@map("refresh_tokens")
}

// ============================================
// MAILBOXES
// ============================================

model Mailbox {
  id              String   @id @default(cuid())
  emailAddress    String   @map("email_address")
  displayName     String?  @map("display_name")
  type            String   @default("personal") // personal, shared
  teamId          String   @map("team_id")
  imapHost        String?  @map("imap_host")
  imapPort        Int?     @map("imap_port")
  imapUser        String?  @map("imap_user")
  imapPasswordEnc String?  @map("imap_password_enc") // encrypted
  smtpHost        String?  @map("smtp_host")
  smtpPort        Int?     @map("smtp_port")
  smtpUser        String?  @map("smtp_user")
  smtpPasswordEnc String?  @map("smtp_password_enc") // encrypted
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  team         Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  access       MailboxAccess[]
  threads      Thread[]
  sharedDrafts SharedDraft[]
  syncState    MailboxSync[]

  @@unique([emailAddress, teamId])
  @@map("mailboxes")
}

model MailboxAccess {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  mailboxId  String   @map("mailbox_id")
  permission String   @default("read") // read, write, admin
  createdAt  DateTime @default(now()) @map("created_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  mailbox Mailbox @relation(fields: [mailboxId], references: [id], onDelete: Cascade)

  @@unique([userId, mailboxId])
  @@map("mailbox_access")
}

model MailboxSync {
  id           String    @id @default(cuid())
  mailboxId    String    @map("mailbox_id")
  folderName   String    @map("folder_name")
  lastUid      Int       @default(0) @map("last_uid")
  lastSyncAt   DateTime? @map("last_sync_at")
  syncStatus   String    @default("idle") // idle, syncing, error
  errorMessage String?   @map("error_message")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  mailbox Mailbox @relation(fields: [mailboxId], references: [id], onDelete: Cascade)

  @@unique([mailboxId, folderName])
  @@map("mailbox_sync")
}

// ============================================
// THREADS & EMAILS
// ============================================

model Thread {
  id             String   @id @default(cuid())
  mailboxId      String   @map("mailbox_id")
  teamId         String   @map("team_id")
  subject        String
  status         String   @default("open") // open, archived, snoozed
  hasSentReply   Boolean  @default(false) @map("has_sent_reply")
  lastActivityAt DateTime @default(now()) @map("last_activity_at")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  mailbox      Mailbox       @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  emails       Email[]
  comments     Comment[]
  assignments  Assignment[]
  tags         ThreadTag[]
  seenBy       SeenBy[]
  sharedDrafts SharedDraft[]

  @@index([mailboxId, status])
  @@index([lastActivityAt])
  @@map("threads")
}

model Email {
  id            String                 @id @default(cuid())
  threadId      String                 @map("thread_id")
  messageId     String                 @map("message_id")
  inReplyTo     String?                @map("in_reply_to")
  references    String[]               @default([])
  imapUid       Int?                   @map("imap_uid")
  subject       String
  bodyText      String                 @map("body_text")
  bodyHtml      String?                @map("body_html")
  fromAddress   String                 @map("from_address")
  fromName      String?                @map("from_name")
  toAddresses   String[]               @map("to_addresses")
  ccAddresses   String[]               @default([]) @map("cc_addresses")
  bccAddresses  String[]               @default([]) @map("bcc_addresses")
  date          DateTime
  folder        String                 @default("INBOX")
  isDraft       Boolean                @default(false) @map("is_draft")
  isSent        Boolean                @default(false) @map("is_sent")
  isBot         Boolean                @default(false) @map("is_bot")
  rawHeaders    Json?                  @map("raw_headers")
  embedding     Unsupported("vector")?
  embeddingModel String?               @map("embedding_model")
  embeddedAt    DateTime?              @map("embedded_at")
  createdAt     DateTime               @default(now()) @map("created_at")
  updatedAt     DateTime               @updatedAt @map("updated_at")

  thread      Thread        @relation(fields: [threadId], references: [id], onDelete: Cascade)
  attachments Attachment[]
  intents     EmailIntent[]
  searchIndex SearchIndex[]

  @@unique([messageId])
  @@index([threadId])
  @@index([imapUid])
  @@map("emails")
}

model Attachment {
  id          String   @id @default(cuid())
  emailId     String   @map("email_id")
  filename    String
  contentType String   @map("content_type")
  size        Int
  storagePath String   @map("storage_path")
  checksum    String?
  quarantined Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")

  email Email @relation(fields: [emailId], references: [id], onDelete: Cascade)

  @@map("attachments")
}

model SearchIndex {
  id       String @id @default(cuid())
  emailId  String @map("email_id")
  token    String // sha256(lowercase(word) + salt)
  position Int

  email Email @relation(fields: [emailId], references: [id], onDelete: Cascade)

  @@index([token])
  @@map("search_index")
}

// ============================================
// COLLABORATION
// ============================================

model Comment {
  id        String   @id @default(cuid())
  threadId  String   @map("thread_id")
  userId    String   @map("user_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  thread Thread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([threadId])
  @@map("comments")
}

model Assignment {
  id           String    @id @default(cuid())
  threadId     String    @map("thread_id")
  assignedToId String    @map("assigned_to_id")
  assignedById String    @map("assigned_by_id")
  status       String    @default("open") // open, in_progress, done
  note         String?
  dueDate      DateTime? @map("due_date")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  thread     Thread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  assignedTo User   @relation("assigned_to", fields: [assignedToId], references: [id], onDelete: Cascade)
  assignedBy User   @relation("assigned_by", fields: [assignedById], references: [id], onDelete: Cascade)

  @@index([threadId])
  @@index([assignedToId])
  @@map("assignments")
}

model SeenBy {
  id              String   @id @default(cuid())
  threadId        String   @map("thread_id")
  userId          String   @map("user_id")
  lastSeenEmailId String?  @map("last_seen_email_id")
  seenAt          DateTime @default(now()) @map("seen_at")

  thread Thread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([threadId, userId])
  @@map("seen_by")
}

// ============================================
// SHARED DRAFTS
// ============================================

model SharedDraft {
  id            String    @id @default(cuid())
  threadId      String?   @map("thread_id")
  mailboxId     String    @map("mailbox_id")
  createdById   String    @map("created_by_id")
  toAddresses   String[]  @map("to_addresses")
  ccAddresses   String[]  @default([]) @map("cc_addresses")
  bccAddresses  String[]  @default([]) @map("bcc_addresses")
  subject       String
  body          String
  status        String    @default("drafting") // drafting, ready_for_review, sent
  lockedById    String?   @map("locked_by_id")
  lockType      String?   @map("lock_type") // editing, generating
  lockExpiresAt DateTime? @map("lock_expires_at")
  confidence    Json?     // DraftConfidence
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  thread    Thread?        @relation(fields: [threadId], references: [id], onDelete: Cascade)
  mailbox   Mailbox        @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  createdBy User           @relation(fields: [createdById], references: [id], onDelete: Cascade)
  versions  DraftVersion[]
  requirements DraftRequirement[]

  @@index([threadId])
  @@map("shared_drafts")
}

model DraftVersion {
  id            String   @id @default(cuid())
  sharedDraftId String   @map("shared_draft_id")
  userId        String   @map("user_id")
  bodySnapshot  String   @map("body_snapshot")
  createdAt     DateTime @default(now()) @map("created_at")

  sharedDraft SharedDraft @relation(fields: [sharedDraftId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("draft_versions")
}

// ============================================
// TAGS & AI
// ============================================

model Tag {
  id        String   @id @default(cuid())
  teamId    String   @map("team_id")
  name      String
  color     String   @default("#6366f1")
  aiAction  String   @default("none") // none, draft, research_draft, auto_reply, archive, notify
  autoRules Json?    @map("auto_rules") // TagRule conditions
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  team    Team        @relation(fields: [teamId], references: [id], onDelete: Cascade)
  threads ThreadTag[]

  @@unique([teamId, name])
  @@map("tags")
}

model ThreadTag {
  id        String   @id @default(cuid())
  threadId  String   @map("thread_id")
  tagId     String   @map("tag_id")
  appliedBy String   @default("manual") @map("applied_by") // manual, auto, ai
  createdAt DateTime @default(now()) @map("created_at")

  thread Thread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([threadId, tagId])
  @@map("thread_tags")
}

model EmailIntent {
  id           String   @id @default(cuid())
  emailId      String   @map("email_id")
  intents      Json     // EmailIntent[]
  extractedAt  DateTime @default(now()) @map("extracted_at")
  modelVersion String?  @map("model_version")

  email        Email              @relation(fields: [emailId], references: [id], onDelete: Cascade)
  requirements DraftRequirement[]

  @@unique([emailId])
  @@map("email_intents")
}

model DraftRequirement {
  id            String  @id @default(cuid())
  intentId      String  @map("intent_id")
  sharedDraftId String  @map("shared_draft_id")
  intentIndex   Int     @map("intent_index")
  addressed     Boolean @default(false)
  source        String? // rag, qa_pair, generated

  intent      EmailIntent @relation(fields: [intentId], references: [id], onDelete: Cascade)
  sharedDraft SharedDraft @relation(fields: [sharedDraftId], references: [id], onDelete: Cascade)

  @@map("draft_requirements")
}

model QAPair {
  id              String   @id @default(cuid())
  teamId          String   @map("team_id")
  triggerPatterns String[] @map("trigger_patterns")
  idealResponse   String   @map("ideal_response")
  tags            String[] @default([])
  usageCount      Int      @default(0) @map("usage_count")
  successRate     Float    @default(0) @map("success_rate")
  autoLearned     Boolean  @default(false) @map("auto_learned")
  approved        Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@map("qa_pairs")
}

// ============================================
// CONTACTS
// ============================================

model Contact {
  id              String    @id @default(cuid())
  teamId          String    @map("team_id")
  email           String
  name            String?
  company         String?
  tags            String[]  @default([])
  notes           String?
  lastContactedAt DateTime? @map("last_contacted_at")
  autoLearned     Boolean   @default(false) @map("auto_learned")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, email])
  @@map("contacts")
}

// ============================================
// AUDIT LOG
// ============================================

model ActivityLog {
  id         String   @id @default(cuid())
  teamId     String   @map("team_id")
  userId     String?  @map("user_id")
  action     String   // login, logout, email_read, email_sent, etc.
  targetType String?  @map("target_type")
  targetId   String?  @map("target_id")
  metadata   Json     @default("{}")
  ipAddress  String?  @map("ip_address")
  checksum   String?  // Hash chain for tamper detection
  createdAt  DateTime @default(now()) @map("created_at")

  team Team  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([teamId, createdAt])
  @@index([userId])
  @@map("activity_logs")
}
```

**Step 3: Create database client**

Create `packages/database/src/client.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Step 4: Create index export**

Create `packages/database/src/index.ts`:
```typescript
export { prisma } from "./client";
export * from "@prisma/client";
```

**Step 5: Create .env file**

Create `packages/database/.env`:
```env
DATABASE_URL="postgresql://emailautomation:emailautomation@localhost:5432/emailautomation?schema=public"
```

**Step 6: Generate Prisma client**

```bash
cd packages/database
pnpm db:generate
```

Expected: Prisma client generated successfully

**Step 7: Push schema to database**

```bash
pnpm db:push
```

Expected: Database synced with schema

**Step 8: Commit**

```bash
cd ../..
git add .
git commit -m "feat: add Prisma schema with all entities"
```

---

## Task 2.2: Database Tests

**Files:**
- Create: `packages/database/tests/setup.ts`
- Create: `packages/database/tests/user.test.ts`
- Create: `packages/database/vitest.config.ts`

**Step 1: Install test dependencies**

```bash
cd packages/database
pnpm add -D vitest testcontainers @testcontainers/postgresql
```

**Step 2: Create vitest config**

Create `packages/database/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

**Step 3: Create test setup**

Create `packages/database/tests/setup.ts`:
```typescript
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

export async function setupTestDatabase() {
  container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  // Run migrations
  execSync("pnpm db:push", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  await prisma.$connect();
  return prisma;
}

export async function teardownTestDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (container) {
    await container.stop();
  }
}

export function getTestPrisma() {
  return prisma;
}
```

**Step 4: Create user tests**

Create `packages/database/tests/user.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { setupTestDatabase, teardownTestDatabase } from "./setup";

let prisma: PrismaClient;

describe("User model", () => {
  beforeAll(async () => {
    prisma = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("creates a team and user", async () => {
    const team = await prisma.team.create({
      data: {
        name: "Test Team",
      },
    });

    expect(team.id).toBeDefined();
    expect(team.name).toBe("Test Team");

    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashed",
        teamId: team.id,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe("test@example.com");
    expect(user.teamId).toBe(team.id);
  });

  it("creates mailbox with access", async () => {
    const team = await prisma.team.create({
      data: { name: "Mailbox Test Team" },
    });

    const user = await prisma.user.create({
      data: {
        email: "mailbox@example.com",
        name: "Mailbox User",
        passwordHash: "hashed",
        teamId: team.id,
      },
    });

    const mailbox = await prisma.mailbox.create({
      data: {
        emailAddress: "info@company.com",
        type: "shared",
        teamId: team.id,
        access: {
          create: {
            userId: user.id,
            permission: "admin",
          },
        },
      },
      include: { access: true },
    });

    expect(mailbox.emailAddress).toBe("info@company.com");
    expect(mailbox.access).toHaveLength(1);
    expect(mailbox.access[0].permission).toBe("admin");
  });

  it("creates thread with email", async () => {
    const team = await prisma.team.create({
      data: { name: "Thread Test Team" },
    });

    const mailbox = await prisma.mailbox.create({
      data: {
        emailAddress: "test@thread.com",
        teamId: team.id,
      },
    });

    const thread = await prisma.thread.create({
      data: {
        mailboxId: mailbox.id,
        teamId: team.id,
        subject: "Test Thread",
        emails: {
          create: {
            messageId: "<test-123@example.com>",
            subject: "Test Email",
            bodyText: "Hello, this is a test",
            fromAddress: "sender@example.com",
            toAddresses: ["test@thread.com"],
            date: new Date(),
          },
        },
      },
      include: { emails: true },
    });

    expect(thread.subject).toBe("Test Thread");
    expect(thread.emails).toHaveLength(1);
    expect(thread.emails[0].bodyText).toBe("Hello, this is a test");
  });
});
```

**Step 5: Run tests**

```bash
pnpm test
```

Expected: All tests pass (may take time for container setup)

**Step 6: Commit**

```bash
cd ../..
git add .
git commit -m "test: add database integration tests with testcontainers"
```

---

# Phase 3: Authentication & Security

## Task 3.1: Password Hashing & 2FA Utilities

**Files:**
- Create: `packages/security/package.json`
- Create: `packages/security/src/index.ts`
- Create: `packages/security/src/password.ts`
- Create: `packages/security/src/totp.ts`
- Create: `packages/security/tests/password.test.ts`

**Step 1: Create security package**

```bash
mkdir -p packages/security/src packages/security/tests
```

**Step 2: Create package.json**

Create `packages/security/package.json`:
```json
{
  "name": "@emailautomation/security",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "bcrypt": "^5.1.0",
    "otplib": "^12.0.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

**Step 3: Install dependencies**

```bash
cd packages/security
pnpm install
```

**Step 4: Create password utilities**

Create `packages/security/src/password.ts`:
```typescript
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Step 5: Create TOTP utilities**

Create `packages/security/src/totp.ts`:
```typescript
import { authenticator } from "otplib";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function generateTotpUri(
  secret: string,
  email: string,
  issuer: string = "EmailAutomation"
): string {
  return authenticator.keyuri(email, issuer, secret);
}

export function verifyTotpToken(secret: string, token: string): boolean {
  return authenticator.verify({ token, secret });
}

export function generateTotpToken(secret: string): string {
  return authenticator.generate(secret);
}
```

**Step 6: Create index export**

Create `packages/security/src/index.ts`:
```typescript
export * from "./password";
export * from "./totp";
```

**Step 7: Create password tests**

Create `packages/security/tests/password.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../src/password";

describe("Password utilities", () => {
  it("hashes and verifies password", async () => {
    const password = "SecurePassword123";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("wrongpassword", hash);
    expect(isInvalid).toBe(false);
  });

  it("validates password strength", () => {
    const weak = validatePasswordStrength("weak");
    expect(weak.valid).toBe(false);
    expect(weak.errors.length).toBeGreaterThan(0);

    const strong = validatePasswordStrength("SecurePassword123");
    expect(strong.valid).toBe(true);
    expect(strong.errors).toHaveLength(0);
  });
});
```

**Step 8: Create TOTP tests**

Create `packages/security/tests/totp.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpToken,
  generateTotpToken,
} from "../src/totp";

describe("TOTP utilities", () => {
  it("generates valid secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(10);
  });

  it("generates valid URI for authenticator apps", () => {
    const secret = generateTotpSecret();
    const uri = generateTotpUri(secret, "test@example.com");

    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("test@example.com");
    expect(uri).toContain("EmailAutomation");
  });

  it("verifies valid token", () => {
    const secret = generateTotpSecret();
    const token = generateTotpToken(secret);

    expect(token).toMatch(/^\d{6}$/);
    expect(verifyTotpToken(secret, token)).toBe(true);
    expect(verifyTotpToken(secret, "000000")).toBe(false);
  });
});
```

**Step 9: Create vitest config**

Create `packages/security/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 10: Run tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 11: Commit**

```bash
cd ../..
git add .
git commit -m "feat: add security package with password hashing and TOTP"
```

---

# Remaining Phases (Summary)

Due to the size of this plan, I'll outline the remaining phases with key tasks. Each would follow the same detailed step-by-step format.

---

## Phase 4: Mail Engine (IMAP/SMTP)

### Task 4.1: Mail Engine Package Setup
- Create `packages/mail-engine/`
- IMAP connection management
- SMTP sender utility

### Task 4.2: IMAP Sync Worker
- Create `workers/sync-worker/`
- Background sync with BullMQ
- UID tracking and incremental sync

### Task 4.3: Email Threading Logic
- Message-ID / In-Reply-To / References parsing
- Thread matching algorithm

### Task 4.4: Attachment Handling
- Download and store attachments
- ClamAV integration for malware scanning

---

## Phase 5: Core UI - Inbox & Threads

### Task 5.1: Setup shadcn/ui
- Install and configure components
- Create base layout components

### Task 5.2: Authentication Pages
- Login page with 2FA
- Session management with NextAuth

### Task 5.3: Inbox Layout
- Three-column responsive layout
- Mailbox sidebar

### Task 5.4: Thread List Component
- Real-time updates with Socket.io
- Unread indicators, tags, assignments

### Task 5.5: Thread Detail View
- Email chain display
- Reply composer with TipTap

---

## Phase 6: Collaboration Features

### Task 6.1: Comments System
- Thread comments CRUD
- Real-time updates

### Task 6.2: Assignments
- Assign/unassign threads
- Status tracking (open/in_progress/done)

### Task 6.3: Seen Status
- Track who viewed threads
- Display avatars

### Task 6.4: Shared Drafts
- Collaborative editing with locking
- Version history

---

## Phase 7: AI Integration

### Task 7.1: AI Engine Package
- Create `packages/ai-engine/`
- Ollama client wrapper

### Task 7.2: Auto-Tagging
- Tag rules engine
- ML classifier integration

### Task 7.3: Intent Extraction
- Email decomposition into intents
- Intent display in UI

### Task 7.4: AI Drafting
- Confidence-based drafting
- Q&A pair matching
- RAG via n8n webhook

### Task 7.5: AI Worker
- Create `workers/ai-worker/`
- Background processing queue

---

## Phase 8: Polish & Production

### Task 8.1: Security Hardening
- Audit logging with checksums
- Rate limiting
- Input sanitization

### Task 8.2: Performance Optimization
- Database indexes
- Query optimization
- Caching layer

### Task 8.3: Production Deployment
- Docker production images
- Environment configuration
- Monitoring setup

### Task 8.4: E2E Testing
- Playwright test suite
- Critical path coverage

---

## Verification Checkpoints

After each phase, verify:

| Phase | Verification |
|-------|--------------|
| 1 | `pnpm dev` starts, `pnpm test` passes |
| 2 | Database migrations run, CRUD tests pass |
| 3 | Can register, login with 2FA |
| 4 | Can sync emails from GreenMail, send test email |
| 5 | Can view inbox, open threads, compose |
| 6 | Can comment, assign, see who viewed |
| 7 | AI tags emails, generates drafts |
| 8 | Passes security audit, handles load |

---

## Getting Started

**Prerequisites:**
1. Node.js 20+
2. pnpm 9+
3. Docker Desktop

**First Steps:**
```bash
# Clone and install
git clone <repo>
cd emailautomation
pnpm install

# Start infrastructure
pnpm docker:up

# Start development
pnpm dev
```

---

**End of Implementation Plan**
