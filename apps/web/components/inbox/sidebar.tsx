"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Inbox,
  Archive,
  Clock,
  Tag,
  Settings,
  LogOut,
  User,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  Sparkles,
  Bot,
  ShieldAlert,
} from "lucide-react";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useTags, type TagData } from "@/hooks/use-tags";
import { useGroupOrder, useCollapsedGroups, useTagOrder } from "@/hooks/use-tag-groups";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateAll } from "@/lib/revalidate";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { mailboxes, isLoading } = useMailboxes();
  const { tags, isLoading: tagsLoading } = useTags();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiProgress, setAIProgress] = useState<string | null>(null);
  const { isCollapsed, toggleGroup } = useCollapsedGroups();
  const { sortGroups } = useGroupOrder();
  const { sortTags } = useTagOrder();

  const router = useRouter();

  const activeTag = searchParams.get("tag");
  const activeTags = searchParams.get("tags");
  const activeGroup = searchParams.get("group");

  function getGroupHref(groupName: string, groupTags: TagData[]) {
    const ids = groupTags.map((t) => t.id).join(",");
    return `/inbox?tags=${ids}&group=${encodeURIComponent(groupName)}`;
  }

  function isGroupActive(groupName: string) {
    return activeGroup === groupName;
  }

  async function handleProcessAI() {
    setIsProcessingAI(true);
    setAIProgress("Starting...");
    try {
      const res = await fetch("/api/ai/process-all", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAIProgress(`Done: ${data.processed}/${data.total} processed`);
        setTimeout(() => setAIProgress(null), 3000);
      } else {
        setAIProgress("Failed");
        setTimeout(() => setAIProgress(null), 3000);
      }
    } catch (error) {
      console.error("AI processing failed:", error);
      setAIProgress(null);
    } finally {
      setIsProcessingAI(false);
      revalidateAll();
      router.refresh();
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Immediately refresh all caches so new threads appear
        revalidateAll();
        router.refresh();
        const hasNewEmails = data.results?.some(
          (r: { newEmails: number }) => r.newEmails > 0
        );
        if (hasNewEmails) {
          handleProcessAI();
        }
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }

  // Group tags: { null: [...ungrouped], "Internal": [...], "Projects": [...] }
  const grouped = (tags || []).reduce<Record<string, TagData[]>>(
    (acc, tag) => {
      const key = tag.tagGroup || "";
      if (!acc[key]) acc[key] = [];
      acc[key].push(tag);
      return acc;
    },
    {}
  );

  const ungrouped = grouped[""] || [];
  const groupNames = sortGroups(
    Object.keys(grouped).filter((k) => k !== "")
  );

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/inbox" className="flex items-center gap-2 font-semibold">
          <Mail className="h-5 w-5" />
          <span>Emaily</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          <NavItem
            href="/inbox"
            icon={Inbox}
            label="Inbox"
            isActive={
              (pathname === "/inbox" || pathname.startsWith("/inbox/")) &&
              !activeTag &&
              !searchParams.get("status")
            }
          />
          <NavItem
            href="/inbox?status=archived"
            icon={Archive}
            label="Archived"
            isActive={searchParams.get("status") === "archived"}
          />
          <NavItem
            href="/inbox?status=snoozed"
            icon={Clock}
            label="Snoozed"
            isActive={searchParams.get("status") === "snoozed"}
          />
          <NavItem
            href="/inbox?status=quarantined"
            icon={ShieldAlert}
            label="Spam"
            isActive={searchParams.get("status") === "quarantined"}
          />
        </div>

        <Separator className="my-4" />

        {/* Mailboxes */}
        <div className="space-y-1">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-sidebar-foreground/60">
            Mailboxes
          </h3>
          {isLoading ? (
            <div className="space-y-2 px-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : mailboxes?.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No mailboxes</p>
          ) : (
            mailboxes?.map((mailbox) => (
              <NavItem
                key={mailbox.id}
                href={`/inbox?mailbox=${mailbox.id}`}
                icon={Mail}
                label={mailbox.displayName || mailbox.emailAddress}
                isActive={pathname.includes(`mailbox=${mailbox.id}`)}
                badge={mailbox._count?.threads}
              />
            ))
          )}
        </div>

        <Separator className="my-4" />

        {/* Tags */}
        <div className="space-y-0.5">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <h3 className="text-xs font-semibold uppercase text-sidebar-foreground/60">
              Tags
            </h3>
            <Link
              href="/tags"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Manage
            </Link>
          </div>

          {tagsLoading ? (
            <div className="space-y-1 px-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : !tags || tags.length === 0 ? (
            <NavItem
              href="/tags"
              icon={Tag}
              label="Create Tags"
              isActive={pathname === "/tags"}
            />
          ) : (
            <>
              {/* All tag groups (named groups + "Other" for ungrouped) */}
              {[...groupNames, ...(ungrouped.length > 0 ? ["__other__"] : [])].map((groupKey) => {
                const isOther = groupKey === "__other__";
                const displayName = isOther ? "Other" : groupKey;
                const rawGroupTags = isOther ? ungrouped : (grouped[groupKey] || []);
                const groupTags = sortTags(groupKey, rawGroupTags);
                const collapsed = isCollapsed(groupKey);
                const groupActive = isGroupActive(displayName);
                const groupThreadCount = groupTags.reduce(
                  (sum, t) => sum + t._count.threads,
                  0
                );

                return (
                  <div key={groupKey}>
                    <div className="flex w-full items-center gap-0.5 rounded-md pr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(groupKey);
                        }}
                        className="shrink-0 p-1 rounded hover:bg-sidebar-accent/50 transition-colors"
                      >
                        {collapsed ? (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                      <Link
                        href={getGroupHref(displayName, groupTags)}
                        className={cn(
                          "flex-1 flex items-center justify-between rounded-md px-1.5 py-1 text-xs font-medium transition-colors",
                          groupActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                        )}
                      >
                        <span className="truncate">{displayName}</span>
                        {groupThreadCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {groupThreadCount}
                          </span>
                        )}
                      </Link>
                    </div>

                    {!collapsed && (
                      <div className="ml-2 space-y-0.5">
                        {groupTags.map((tag) => (
                          <TagNavItem
                            key={tag.id}
                            tag={tag}
                            isActive={activeTag === tag.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Sync & AI Buttons */}
      <div className="border-t p-3 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")}
          />
          {isSyncing ? "Syncing..." : "Sync Mail"}
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleProcessAI}
          disabled={isProcessingAI}
        >
          <Sparkles
            className={cn("mr-2 h-4 w-4", isProcessingAI && "animate-pulse")}
          />
          {isProcessingAI
            ? aiProgress || "Processing..."
            : aiProgress || "Process All with AI"}
        </Button>
      </div>

      {/* User Menu */}
      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {session?.user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{session?.user?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {session?.user?.teamName}
                  </p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/agents">
                <Bot className="mr-2 h-4 w-4" />
                AI Agents
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function TagNavItem({
  tag,
  isActive,
}: {
  tag: TagData;
  isActive: boolean;
}) {
  return (
    <Link
      href={`/inbox?tag=${tag.id}`}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: tag.color }}
      />
      <span className="flex-1 truncate">{tag.name}</span>
      {tag._count.threads > 0 && (
        <span className="text-xs text-muted-foreground">
          {tag._count.threads}
        </span>
      )}
    </Link>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-md px-2 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}
