"use client";

import * as React from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MainLayout component provides the primary layout structure for the email client.
 *
 * Features:
 * - Fixed header at the top
 * - Collapsible sidebar on the left
 * - Responsive design with mobile-friendly navigation
 * - Main content area that adapts to sidebar state
 * - Overlay for mobile sidebar
 */
export function MainLayout({ children, className }: MainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  // Handle sidebar collapse toggle
  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  // Handle mobile sidebar toggle
  const handleToggleMobileSidebar = () => {
    setIsMobileSidebarOpen((prev) => !prev);
  };

  // Close mobile sidebar when clicking overlay
  const handleOverlayClick = () => {
    setIsMobileSidebarOpen(false);
  };

  // Close mobile sidebar on escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  React.useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header - Fixed at top */}
      <Header
        onMenuToggle={handleToggleMobileSidebar}
        showMenuToggle={true}
      />

      {/* Main content area with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden lg:block">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            className="h-full"
          />
        </div>

        {/* Mobile sidebar overlay */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}

        {/* Mobile sidebar - slides in from left */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 lg:hidden",
            "transform transition-transform duration-300 ease-in-out",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar
            isCollapsed={false}
            onToggleCollapse={() => setIsMobileSidebarOpen(false)}
            className="h-full shadow-lg"
          />
        </div>

        {/* Main content */}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            "transition-all duration-300",
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * ContentContainer provides consistent padding and max-width for page content.
 * Use this inside MainLayout for consistent content spacing.
 */
export function ContentContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-4 lg:p-6 max-w-7xl mx-auto", className)}>
      {children}
    </div>
  );
}

/**
 * SplitView provides a two-column layout for list/detail views.
 * Common pattern for email clients: list on left, detail on right.
 */
export interface SplitViewProps {
  children: React.ReactNode;
  className?: string;
}

export function SplitView({ children, className }: SplitViewProps) {
  return (
    <div className={cn("flex h-full", className)}>
      {children}
    </div>
  );
}

/**
 * SplitViewPanel represents one side of a split view.
 */
export interface SplitViewPanelProps {
  children: React.ReactNode;
  className?: string;
  width?: "narrow" | "medium" | "wide" | "flex";
}

export function SplitViewPanel({
  children,
  className,
  width = "flex",
}: SplitViewPanelProps) {
  const widthClasses = {
    narrow: "w-80 flex-shrink-0",
    medium: "w-96 flex-shrink-0",
    wide: "w-[480px] flex-shrink-0",
    flex: "flex-1",
  };

  return (
    <div
      className={cn(
        "overflow-y-auto",
        widthClasses[width],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * SplitViewDivider provides a visual separator between split view panels.
 * Can be made draggable for resizable panels (future enhancement).
 */
export function SplitViewDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-px bg-border flex-shrink-0",
        className
      )}
    />
  );
}
