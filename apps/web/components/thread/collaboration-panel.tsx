"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollaborationPanelProps {
  children: React.ReactNode;
  className?: string;
}

const STORAGE_KEY = "collaboration-panel-collapsed";

export function CollaborationPanel({ children, className }: CollaborationPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
    setIsHydrated(true);
  }, []);

  function toggleCollapsed() {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(STORAGE_KEY, String(newState));
  }

  // Prevent flash of wrong state during hydration
  if (!isHydrated) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col border-l bg-muted/20 transition-all duration-200",
        isCollapsed ? "w-10" : "w-80",
        className
      )}
    >
      <div className="flex h-10 items-center justify-between border-b px-2">
        {!isCollapsed && (
          <span className="text-sm font-medium text-muted-foreground">
            Team
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleCollapsed}
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? (
            <PanelRightOpen className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!isCollapsed && (
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {children}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface PanelSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({ title, icon, children, defaultOpen = true }: PanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <span className="text-xs">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
