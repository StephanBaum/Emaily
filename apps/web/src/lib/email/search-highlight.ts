/**
 * Search Result Highlighting Utilities
 *
 * Provides functions for generating highlighted search result snippets
 * using PostgreSQL's ts_headline full-text search highlighting.
 */

/**
 * Configuration for ts_headline highlighting
 */
export interface HighlightConfig {
  /** Start delimiter for highlighted text (default: <mark>) */
  startSel?: string;
  /** End delimiter for highlighted text (default: </mark>) */
  stopSel?: string;
  /** Maximum words in snippet (default: 35) */
  maxWords?: number;
  /** Minimum words in snippet (default: 15) */
  minWords?: number;
  /** Shortest word to highlight (default: 3) */
  shortWord?: number;
  /** Include surrounding context (default: true) */
  highlightAll?: boolean;
  /** Maximum fragments to show (default: 1) */
  maxFragments?: number;
  /** Fragment delimiter (default: " ... ") */
  fragmentDelimiter?: string;
}

/**
 * Default highlighting configuration
 */
export const DEFAULT_HIGHLIGHT_CONFIG: HighlightConfig = {
  startSel: "<mark>",
  stopSel: "</mark>",
  maxWords: 35,
  minWords: 15,
  shortWord: 3,
  highlightAll: false,
  maxFragments: 1,
  fragmentDelimiter: " ... ",
};

/**
 * Highlighted search result with snippets
 */
export interface HighlightedResult {
  /** Highlighted subject line */
  subjectHighlight?: string;
  /** Highlighted body snippet */
  bodyHighlight?: string;
  /** Highlighted sender name/email */
  senderHighlight?: string;
}

/**
 * Build PostgreSQL ts_headline options string
 */
export function buildHeadlineOptions(config: HighlightConfig = {}): string {
  const options = { ...DEFAULT_HIGHLIGHT_CONFIG, ...config };

  const parts: string[] = [];

  if (options.startSel) {
    parts.push(`StartSel=${options.startSel}`);
  }

  if (options.stopSel) {
    parts.push(`StopSel=${options.stopSel}`);
  }

  if (options.maxWords !== undefined) {
    parts.push(`MaxWords=${options.maxWords}`);
  }

  if (options.minWords !== undefined) {
    parts.push(`MinWords=${options.minWords}`);
  }

  if (options.shortWord !== undefined) {
    parts.push(`ShortWord=${options.shortWord}`);
  }

  if (options.highlightAll !== undefined) {
    parts.push(`HighlightAll=${options.highlightAll ? "true" : "false"}`);
  }

  if (options.maxFragments !== undefined) {
    parts.push(`MaxFragments=${options.maxFragments}`);
  }

  if (options.fragmentDelimiter) {
    parts.push(`FragmentDelimiter=${options.fragmentDelimiter}`);
  }

  return parts.join(", ");
}

/**
 * Sanitize highlighted HTML to prevent XSS attacks
 * Only allows <mark> tags, strips all other HTML
 */
export function sanitizeHighlight(html: string): string {
  if (!html) return "";

  // Remove all HTML tags except <mark> and </mark>
  return html
    .replace(/<(?!mark>|\/mark>)[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

/**
 * Extract plain text from highlighted snippet for fallback display
 */
export function stripHighlightTags(highlighted: string): string {
  if (!highlighted) return "";

  return highlighted
    .replace(/<mark>/g, "")
    .replace(/<\/mark>/g, "")
    .trim();
}

/**
 * Generate SQL SELECT fields for highlighted search results
 */
export function generateHighlightFields(
  searchQuery: string,
  config: HighlightConfig = {}
): string {
  const options = buildHeadlineOptions(config);

  return `
    ts_headline('english', COALESCE("subject", ''), to_tsquery('english', $searchQuery$), '${options}') as "subjectHighlight",
    ts_headline('english', COALESCE("bodyText", ''), to_tsquery('english', $searchQuery$), '${options}') as "bodyHighlight",
    ts_headline('english', COALESCE("sender", ''), to_tsquery('english', $searchQuery$), '${options}') as "senderHighlight"
  `.trim();
}

/**
 * Check if text contains any highlighted matches
 */
export function hasHighlights(highlighted: string): boolean {
  return highlighted.includes("<mark>");
}

/**
 * Count number of highlighted terms in text
 */
export function countHighlights(highlighted: string): number {
  const matches = highlighted.match(/<mark>/g);
  return matches ? matches.length : 0;
}

/**
 * Truncate highlighted text to max length while preserving highlights
 */
export function truncateHighlight(
  highlighted: string,
  maxLength: number
): string {
  if (!highlighted || highlighted.length <= maxLength) {
    return highlighted;
  }

  // Try to truncate at a space before maxLength
  let truncated = highlighted.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.7) {
    truncated = truncated.substring(0, lastSpace);
  }

  // Ensure <mark> tags are properly closed
  const openTags = (truncated.match(/<mark>/g) || []).length;
  const closeTags = (truncated.match(/<\/mark>/g) || []).length;

  if (openTags > closeTags) {
    truncated += "</mark>";
  }

  return truncated + "...";
}
