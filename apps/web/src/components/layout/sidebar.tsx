"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Navigation item interface for sidebar links
 */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

/**
 * Category filter item interface
 */
interface CategoryItem {
  id: string;
  label: string;
  color: string;
  count?: number;
}

export interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Email-related SVG icons
const InboxIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
    />
  </svg>
);

const StarIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
  </svg>
);

const SendIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
    />
  </svg>
);

const DraftIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
    />
  </svg>
);

const ArchiveIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
    />
  </svg>
);

const TrashIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

const SpamIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    />
  </svg>
);

const CollapseIcon = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <svg
    className={cn("h-5 w-5 transition-transform", isCollapsed && "rotate-180")}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 19.5L8.25 12l7.5-7.5"
    />
  </svg>
);

const ComposeIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </svg>
);

// Default navigation items
const defaultNavItems: NavItem[] = [
  { label: "Inbox", href: "/inbox", icon: <InboxIcon /> },
  { label: "Starred", href: "/inbox?filter=starred", icon: <StarIcon /> },
  { label: "Sent", href: "/inbox?filter=sent", icon: <SendIcon /> },
  { label: "Drafts", href: "/inbox?filter=drafts", icon: <DraftIcon /> },
  { label: "Archive", href: "/inbox?filter=archived", icon: <ArchiveIcon /> },
  { label: "Spam", href: "/inbox?filter=spam", icon: <SpamIcon /> },
  { label: "Trash", href: "/inbox?filter=trash", icon: <TrashIcon /> },
];

// AI-powered category filters
const defaultCategories: CategoryItem[] = [
  { id: "important", label: "Important", color: "bg-red-500" },
  { id: "updates", label: "Updates", color: "bg-blue-500" },
  { id: "social", label: "Social", color: "bg-green-500" },
  { id: "promotional", label: "Promotional", color: "bg-yellow-500" },
];

/**
 * NavItem component for sidebar navigation links
 */
function NavItemButton({
  item,
  isActive,
  isCollapsed,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  return (
    <Link href={item.href} className="w-full">
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start gap-3",
          isCollapsed ? "px-3" : "px-4"
        )}
      >
        {item.icon}
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="ml-auto text-xs font-medium bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </>
        )}
      </Button>
    </Link>
  );
}

/**
 * CategoryFilter component for AI category filtering
 */
function CategoryFilter({
  category,
  isCollapsed,
  onClick,
}: {
  category: CategoryItem;
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm",
        "hover:bg-accent hover:text-accent-foreground transition-colors",
        isCollapsed && "justify-center px-3"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", category.color)} />
      {!isCollapsed && (
        <>
          <span className="flex-1 text-left">{category.label}</span>
          {category.count !== undefined && category.count > 0 && (
            <span className="text-xs text-muted-foreground">
              {category.count}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/**
 * Sidebar component for the email client.
 *
 * Features:
 * - Compose button for new emails
 * - Navigation links (Inbox, Starred, Sent, Drafts, etc.)
 * - AI-powered category filters
 * - Collapsible design for space efficiency
 * - Active state highlighting based on current route
 */
export function Sidebar({
  className,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  // Determine if a nav item is active
  const isNavItemActive = (href: string) => {
    if (href === "/inbox" && pathname === "/inbox") {
      return true;
    }
    return pathname.startsWith(href) && href !== "/inbox";
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-background border-r",
        isCollapsed ? "w-16" : "w-64",
        "transition-all duration-300",
        className
      )}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end p-2 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <CollapseIcon isCollapsed={isCollapsed} />
        </Button>
      </div>

      {/* Compose button */}
      <div className="p-3">
        <Button
          className={cn(
            "gap-2",
            isCollapsed ? "w-10 px-0" : "w-full"
          )}
        >
          <ComposeIcon />
          {!isCollapsed && <span>Compose</span>}
        </Button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {defaultNavItems.map((item) => (
            <NavItemButton
              key={item.href}
              item={item}
              isActive={isNavItemActive(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Categories section */}
        {!isCollapsed && (
          <div className="mt-6">
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Categories
            </h3>
            <div className="space-y-1">
              {defaultCategories.map((category) => (
                <CategoryFilter
                  key={category.id}
                  category={category}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer / Storage info */}
      {!isCollapsed && (
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground">
            <div className="flex justify-between mb-1">
              <span>Storage used</span>
              <span>2.4 GB of 15 GB</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "16%" }}
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
