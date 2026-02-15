import { useCallback } from "react";
import { usePreferences } from "@/contexts/preferences-context";
import { formatDate, formatDateCompact } from "@/lib/format-date";

export function useFormattedDate() {
  const { preferences } = usePreferences();
  const dateFormat = preferences.dateFormat;

  const full = useCallback(
    (date: Date | string) => formatDate(date, dateFormat),
    [dateFormat]
  );

  const compact = useCallback(
    (date: Date | string) => formatDateCompact(date, dateFormat),
    [dateFormat]
  );

  return { formatDate: full, formatDateCompact: compact };
}
