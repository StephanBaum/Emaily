import { formatDistanceToNow, format } from "date-fns";

type DateFormat = "relative" | "absolute" | "iso";

/**
 * Full date format for display in normal contexts.
 * - relative: "3 hours ago"
 * - absolute: "Feb 15, 2026 at 3:45 PM"
 * - iso: "2026-02-15 15:45"
 */
export function formatDate(date: Date | string, dateFormat: DateFormat): string {
  const d = typeof date === "string" ? new Date(date) : date;

  switch (dateFormat) {
    case "relative":
      return formatDistanceToNow(d, { addSuffix: true });
    case "absolute":
      return format(d, "MMM d, yyyy 'at' h:mm a");
    case "iso":
      return format(d, "yyyy-MM-dd HH:mm");
  }
}

/**
 * Compact date format for tight UI spaces (thread lists, badges).
 * - relative: "3h"
 * - absolute: "Feb 15, 3:45 PM"
 * - iso: "02-15 15:45"
 */
export function formatDateCompact(date: Date | string, dateFormat: DateFormat): string {
  const d = typeof date === "string" ? new Date(date) : date;

  switch (dateFormat) {
    case "relative": {
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "now";
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      return `${diffDays}d`;
    }
    case "absolute":
      return format(d, "MMM d, h:mm a");
    case "iso":
      return format(d, "MM-dd HH:mm");
  }
}
