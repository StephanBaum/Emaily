"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Mail, Tag, SlidersHorizontal, Users, Bot, Key } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Profile", href: "/settings/profile", icon: User },
  { label: "Mailboxes", href: "/settings/mailboxes", icon: Mail },
  { label: "Tags", href: "/settings/tags", icon: Tag },
  { label: "Preferences", href: "/settings/preferences", icon: SlidersHorizontal },
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "AI Agents", href: "/settings/agents", icon: Bot },
  { label: "API Keys", href: "/settings/api-keys", icon: Key },
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
