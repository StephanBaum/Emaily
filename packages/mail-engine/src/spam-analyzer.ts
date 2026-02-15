/**
 * Spam analyzer — pure functions for scoring email trustworthiness from headers.
 * No database dependencies. Takes raw headers and returns structured analysis.
 */

import type { SpamAnalysisResult } from "@emaily/shared";

interface SpamAnalyzerInput {
  headers: Record<string, string>;
  fromAddress: string;
  subject: string;
}

type AuthResult = "pass" | "fail" | "softfail" | "none" | "unknown";

/**
 * Parse authentication results from email headers.
 * Checks `authentication-results`, `received-spf`, and related headers.
 */
function parseAuthResults(headers: Record<string, string>): {
  spf: AuthResult;
  dkim: AuthResult;
  dmarc: AuthResult;
} {
  const authResults = (
    headers["authentication-results"] || ""
  ).toLowerCase();
  const receivedSpf = (headers["received-spf"] || "").toLowerCase();

  function extractResult(
    text: string,
    protocol: string
  ): AuthResult {
    // Match patterns like "spf=pass", "dkim=fail", "dmarc=none"
    const regex = new RegExp(`${protocol}\\s*=\\s*(pass|fail|softfail|none)`);
    const match = text.match(regex);
    if (match) return match[1] as AuthResult;
    return "unknown";
  }

  let spf = extractResult(authResults, "spf");
  if (spf === "unknown" && receivedSpf) {
    // Fall back to dedicated Received-SPF header
    if (receivedSpf.startsWith("pass")) spf = "pass";
    else if (receivedSpf.startsWith("fail")) spf = "fail";
    else if (receivedSpf.startsWith("softfail")) spf = "softfail";
    else if (receivedSpf.startsWith("none")) spf = "none";
  }

  const dkim = extractResult(authResults, "dkim");
  const dmarc = extractResult(authResults, "dmarc");

  return { spf, dkim, dmarc };
}

/**
 * Analyze email headers for spam signals.
 * Returns a structured breakdown of all checks performed.
 */
export function analyzeSpam(input: SpamAnalyzerInput): SpamAnalysisResult {
  const { headers, fromAddress } = input;
  const signals: string[] = [];

  // 1. Authentication checks
  const { spf, dkim, dmarc } = parseAuthResults(headers);

  // 2. SpamAssassin / rspamd headers
  const xSpamStatus = headers["x-spam-status"] || null;
  const xSpamScoreRaw = headers["x-spam-score"] || null;
  const xSpamScore = xSpamScoreRaw ? parseFloat(xSpamScoreRaw) : null;

  if (xSpamStatus?.toLowerCase().startsWith("yes")) {
    signals.push("X-Spam-Status: Yes");
  }
  if (xSpamScore !== null && xSpamScore > 5.0) {
    signals.push(`X-Spam-Score: ${xSpamScore}`);
  }

  // 3. Google spam headers
  const googleSpamVerdict =
    headers["x-gm-spam"] || headers["x-gm-phishy"] || null;
  if (googleSpamVerdict) {
    signals.push(`Google spam header: ${googleSpamVerdict}`);
  }

  // 4. From/Reply-To mismatch
  const replyTo = headers["reply-to"] || "";
  const fromDomain = fromAddress.split("@")[1]?.toLowerCase() || "";
  const replyToDomain = replyTo.includes("@")
    ? replyTo.split("@")[1]?.replace(/>.*$/, "").toLowerCase() || ""
    : "";
  const fromReplyToMismatch =
    !!replyToDomain && !!fromDomain && replyToDomain !== fromDomain;
  if (fromReplyToMismatch) {
    signals.push(`From/Reply-To domain mismatch: ${fromDomain} vs ${replyToDomain}`);
  }

  // 5. Bulk precedence without List-Id
  const precedence = (headers["precedence"] || "").toLowerCase();
  const listId = headers["list-id"] || "";
  const bulkPrecedence = precedence === "bulk" && !listId;
  if (bulkPrecedence) {
    signals.push("Precedence: bulk without List-Id");
  }

  // Auth signal descriptions
  if (spf === "fail") signals.push("SPF: fail");
  else if (spf === "softfail") signals.push("SPF: softfail");
  else if (spf === "none") signals.push("SPF: none");

  if (dkim === "fail") signals.push("DKIM: fail");
  else if (dkim === "none") signals.push("DKIM: none");

  if (dmarc === "fail") signals.push("DMARC: fail");
  else if (dmarc === "none") signals.push("DMARC: none");

  const headerScore = computeSpamScore({
    spf,
    dkim,
    dmarc,
    xSpamScore,
    xSpamStatus,
    googleSpamVerdict,
    bulkPrecedence,
    fromReplyToMismatch,
    signals,
  });

  return {
    spf,
    dkim,
    dmarc,
    xSpamScore,
    xSpamStatus,
    googleSpamVerdict,
    bulkPrecedence,
    fromReplyToMismatch,
    headerScore,
    signals,
  };
}

/**
 * Compute a weighted spam score from analysis results.
 * Returns 0.0 (ham) to 1.0 (spam).
 */
export function computeSpamScore(
  analysis: Omit<SpamAnalysisResult, "headerScore">
): number {
  let score = 0;

  // SPF
  if (analysis.spf === "fail") score += 0.3;
  else if (analysis.spf === "softfail") score += 0.15;
  else if (analysis.spf === "none") score += 0.1;

  // DKIM
  if (analysis.dkim === "fail") score += 0.25;
  else if (analysis.dkim === "none") score += 0.1;

  // DMARC
  if (analysis.dmarc === "fail") score += 0.3;
  else if (analysis.dmarc === "none") score += 0.05;

  // SpamAssassin / rspamd
  if (
    analysis.xSpamStatus?.toLowerCase().startsWith("yes") ||
    (analysis.xSpamScore !== null && analysis.xSpamScore > 5.0)
  ) {
    score += 0.4;
  }

  // Google headers
  if (analysis.googleSpamVerdict) {
    score += 0.5;
  }

  // From/Reply-To mismatch
  if (analysis.fromReplyToMismatch) {
    score += 0.1;
  }

  // Bulk precedence without List-Id
  if (analysis.bulkPrecedence) {
    score += 0.05;
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/** Threshold constants */
export const SPAM_THRESHOLD_QUARANTINE = 0.7;
export const SPAM_THRESHOLD_SUSPICIOUS = 0.4;
