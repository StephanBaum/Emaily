/**
 * Format a count with singular/plural form.
 * @example formatPlural(1, "message", "messages") => "1 message"
 * @example formatPlural(5, "message", "messages") => "5 messages"
 */
export function formatPlural(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Format relative time in human-readable form.
 * @example formatRelativeTime(2, "day") => "2 days ago"
 */
export function formatRelativeTime(value: number, unit: string): string {
  const unitStr = value === 1 ? unit : `${unit}s`;
  return `${value} ${unitStr} ago`;
}

/**
 * Get initials from a name (up to 2 characters).
 * @example getInitials("John Doe") => "JD"
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a byte count as a human-readable file size.
 * @example formatFileSize(1536) => "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
