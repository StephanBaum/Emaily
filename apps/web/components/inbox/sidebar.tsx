"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Mail,
} from "lucide-react";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { mailboxes, isLoading } = useMailboxes();
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSync() {
    setIsSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/inbox" className="flex items-center gap-2 font-semibold">
          <Mail className="h-5 w-5" />
          <span>Email Client</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          <NavItem
            href="/inbox"
            icon={Inbox}
            label="Inbox"
            isActive={pathname === "/inbox" || pathname.startsWith("/inbox/")}
          />
          <NavItem
            href="/inbox?status=archived"
            icon={Archive}
            label="Archived"
            isActive={pathname.includes("archived")}
          />
          <NavItem
            href="/inbox?status=snoozed"
            icon={Clock}
            label="Snoozed"
            isActive={pathname.includes("snoozed")}
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
        <div className="space-y-1">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-sidebar-foreground/60">
            Tags
          </h3>
          <NavItem
            href="/tags"
            icon={Tag}
            label="Manage Tags"
            isActive={pathname === "/tags"}
          />
        </div>
      </ScrollArea>

      {/* Sync Button */}
      <div className="border-t p-3">
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
