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
