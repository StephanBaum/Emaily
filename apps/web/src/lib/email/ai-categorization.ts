/**
 * AI Email Categorization Service
 * Handles automatic categorization of emails using AI
 */

import type { Email, Prisma } from "@email-ai/database";

/**
 * Result of categorizing a single email
 */
export interface CategorizationResult {
  emailId: string;
  success: boolean;
  category?: string;
  priority?: number;
  summary?: string;
  error?: string;
}

/**
 * Result of batch categorization
 */
export interface BatchCategorizationResult {
  total: number;
  categorized: number;
  failed: number;
  results: CategorizationResult[];
}

/**
 * Options for categorization
 */
export interface CategorizationOptions {
  /** Maximum emails to process in one batch */
  batchSize?: number;
  /** Delay between API calls in ms (to avoid rate limits) */
  delayBetweenCalls?: number;
  /** Callback for progress updates */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Prisma client interface for categorization operations
 */
export interface PrismaCategorizationClient {
  email: {
    findMany: (args: Prisma.EmailFindManyArgs) => Promise<Email[]>;
    update: (args: {
      where: { id: string };
      data: Prisma.EmailUpdateInput;
    }) => Promise<Email>;
  };
}

/**
 * Categorize a single email using the AI API
 * This function calls the internal AI categorization API
 */
export async function categorizeEmailWithAI(
  email: { id: string; subject: string; body: string; sender: string; recipients?: string[] },
  baseUrl: string = ""
): Promise<CategorizationResult> {
  try {
    const response = await fetch(`${baseUrl}/api/ai/categorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: email.subject,
        body: email.body.substring(0, 5000), // Limit body size for API
        sender: email.sender,
        recipients: email.recipients,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        emailId: email.id,
        success: false,
        error: errorData.message || `API error: ${response.status}`,
      };
    }

    const result = await response.json();

    return {
      emailId: email.id,
      success: true,
      category: result.category,
      priority: result.priority,
      summary: result.summary,
    };
  } catch (error) {
    return {
      emailId: email.id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Categorize emails directly using the AI package (server-side only)
 * This avoids HTTP overhead when called from API routes
 */
export async function categorizeEmailDirect(
  email: { id: string; subject: string; body: string; sender?: string; recipients?: string[] }
): Promise<CategorizationResult> {
  try {
    // Dynamic import to avoid client-side bundling issues
    const { categorizeEmail } = await import("@email-ai/ai");

    const result = await categorizeEmail({
      subject: email.subject,
      body: email.body.substring(0, 5000), // Limit body size
      sender: email.sender,
      recipients: email.recipients,
    });

    return {
      emailId: email.id,
      success: true,
      category: result.category,
      priority: result.priority,
      summary: result.summary,
    };
  } catch (error) {
    return {
      emailId: email.id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get uncategorized emails from the database
 */
export async function getUncategorizedEmails(
  prisma: PrismaCategorizationClient,
  accountId?: string,
  limit: number = 50
): Promise<Email[]> {
  const where: Prisma.EmailWhereInput = {
    category: null,
  };

  if (accountId) {
    where.accountId = accountId;
  }

  return prisma.email.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: limit,
  });
}

/**
 * Update email with categorization results
 */
export async function updateEmailCategorization(
  prisma: PrismaCategorizationClient,
  emailId: string,
  result: CategorizationResult
): Promise<void> {
  if (!result.success) {
    return;
  }

  await prisma.email.update({
    where: { id: emailId },
    data: {
      category: result.category,
      priority: result.priority,
      summary: result.summary,
      updatedAt: new Date(),
    },
  });
}

/**
 * Batch categorize uncategorized emails
 * Uses direct AI calls for efficiency (server-side)
 */
export async function batchCategorizeEmails(
  prisma: PrismaCategorizationClient,
  emails: Array<{ id: string; subject: string; body: string; sender: string; recipients?: string[] }>,
  options: CategorizationOptions = {}
): Promise<BatchCategorizationResult> {
  const {
    delayBetweenCalls = 200,
    onProgress,
  } = options;

  const results: CategorizationResult[] = [];
  let categorized = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    // Categorize the email
    const result = await categorizeEmailDirect(email);
    results.push(result);

    if (result.success) {
      // Update the database
      await updateEmailCategorization(prisma, email.id, result);
      categorized++;
    } else {
      failed++;
    }

    // Report progress
    onProgress?.(i + 1, emails.length);

    // Add delay between calls to avoid rate limits
    if (i < emails.length - 1 && delayBetweenCalls > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenCalls));
    }
  }

  return {
    total: emails.length,
    categorized,
    failed,
    results,
  };
}

/**
 * Categorize all uncategorized emails for an account
 */
export async function categorizeUncategorizedEmails(
  prisma: PrismaCategorizationClient,
  accountId?: string,
  options: CategorizationOptions = {}
): Promise<BatchCategorizationResult> {
  const { batchSize = 50 } = options;

  // Get uncategorized emails
  const emails = await getUncategorizedEmails(prisma, accountId, batchSize);

  if (emails.length === 0) {
    return {
      total: 0,
      categorized: 0,
      failed: 0,
      results: [],
    };
  }

  // Map emails to the format needed for categorization
  const emailsForCategorization = emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    body: email.body,
    sender: email.sender,
    recipients: email.recipients,
  }));

  return batchCategorizeEmails(prisma, emailsForCategorization, options);
}
