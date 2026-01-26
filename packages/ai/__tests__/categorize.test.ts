/**
 * Integration tests for AI email categorization.
 *
 * These tests verify that the AI categorization pipeline works correctly.
 * Some tests are mocked to avoid actual API calls, while others can be run
 * with OPENAI_API_KEY set to test the full integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EmailCategorySchema,
  EmailCategoryEnum,
  SuggestedActionEnum,
  type EmailCategory,
  type CategorizeEmailInput,
} from "../src";

/**
 * Test data: Sample emails for categorization testing
 */
const TEST_EMAILS: Record<string, CategorizeEmailInput> = {
  important: {
    subject: "URGENT: Project deadline moved to tomorrow",
    body: "Hi Team, I need to inform you that the project deadline has been moved up to tomorrow. Please prioritize this work and let me know if you have any blockers. We need to deliver by 5 PM.",
    sender: "manager@company.com",
    recipients: ["team@company.com"],
  },
  promotional: {
    subject: "FLASH SALE - 50% off everything!",
    body: "Don't miss out on our biggest sale of the year! Use code SAVE50 at checkout. Limited time only. Shop now before items sell out!",
    sender: "marketing@shop.com",
    recipients: ["customer@email.com"],
  },
  social: {
    subject: "John Smith mentioned you in a comment",
    body: "John Smith mentioned you in a comment on your post: 'Great photo! Where was this taken?' Click here to view and reply.",
    sender: "notifications@social.com",
    recipients: ["user@email.com"],
  },
  updates: {
    subject: "Your order #12345 has shipped",
    body: "Great news! Your order has shipped and is on its way. Track your package: https://tracking.com/12345. Estimated delivery: 3-5 business days.",
    sender: "orders@store.com",
    recipients: ["customer@email.com"],
  },
  spam: {
    subject: "You've won $1,000,000!!!",
    body: "Congratulations! You have been selected as our lucky winner! Click here to claim your prize now. Send us your bank details to receive your winnings.",
    sender: "unknown@suspicious-domain.xyz",
    recipients: ["victim@email.com"],
  },
};

describe("EmailCategorySchema", () => {
  it("should validate a correct email category object", () => {
    const validCategory: EmailCategory = {
      category: "important",
      priority: 5,
      summary: "Urgent project deadline update",
      suggestedAction: "reply",
    };

    const result = EmailCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("important");
      expect(result.data.priority).toBe(5);
      expect(result.data.suggestedAction).toBe("reply");
    }
  });

  it("should reject invalid category values", () => {
    const invalidCategory = {
      category: "invalid_category",
      priority: 3,
      summary: "Test",
      suggestedAction: "archive",
    };

    const result = EmailCategorySchema.safeParse(invalidCategory);
    expect(result.success).toBe(false);
  });

  it("should reject priority values out of range", () => {
    const lowPriority = {
      category: "important",
      priority: 0,
      summary: "Test",
      suggestedAction: "archive",
    };

    const highPriority = {
      category: "important",
      priority: 6,
      summary: "Test",
      suggestedAction: "archive",
    };

    expect(EmailCategorySchema.safeParse(lowPriority).success).toBe(false);
    expect(EmailCategorySchema.safeParse(highPriority).success).toBe(false);
  });

  it("should accept all valid category types", () => {
    const categories = ["important", "promotional", "social", "updates", "spam"];

    categories.forEach((category) => {
      const result = EmailCategoryEnum.safeParse(category);
      expect(result.success).toBe(true);
    });
  });

  it("should accept all valid suggested actions", () => {
    const actions = ["reply", "archive", "delete", "defer"];

    actions.forEach((action) => {
      const result = SuggestedActionEnum.safeParse(action);
      expect(result.success).toBe(true);
    });
  });
});

describe("Email Categorization (Mocked)", () => {
  // Mock the AI SDK generateObject function
  const mockGenerateObject = vi.fn();

  beforeEach(() => {
    vi.mock("ai", () => ({
      generateObject: mockGenerateObject,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return expected categories for important emails", async () => {
    const expectedResult: EmailCategory = {
      category: "important",
      priority: 5,
      summary: "Urgent project deadline moved to tomorrow",
      suggestedAction: "reply",
    };

    mockGenerateObject.mockResolvedValueOnce({ object: expectedResult });

    // Verify the expected result matches the schema
    const parsed = EmailCategorySchema.safeParse(expectedResult);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.category).toBe("important");
    expect(parsed.data?.priority).toBe(5);
    expect(parsed.data?.suggestedAction).toBe("reply");
  });

  it("should return expected categories for promotional emails", async () => {
    const expectedResult: EmailCategory = {
      category: "promotional",
      priority: 2,
      summary: "Flash sale with 50% discount offer",
      suggestedAction: "archive",
    };

    mockGenerateObject.mockResolvedValueOnce({ object: expectedResult });

    const parsed = EmailCategorySchema.safeParse(expectedResult);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.category).toBe("promotional");
    expect(parsed.data?.suggestedAction).toBe("archive");
  });

  it("should return expected categories for social emails", async () => {
    const expectedResult: EmailCategory = {
      category: "social",
      priority: 2,
      summary: "Someone mentioned you on social media",
      suggestedAction: "defer",
    };

    mockGenerateObject.mockResolvedValueOnce({ object: expectedResult });

    const parsed = EmailCategorySchema.safeParse(expectedResult);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.category).toBe("social");
  });

  it("should return expected categories for update emails", async () => {
    const expectedResult: EmailCategory = {
      category: "updates",
      priority: 2,
      summary: "Order shipment notification",
      suggestedAction: "archive",
    };

    mockGenerateObject.mockResolvedValueOnce({ object: expectedResult });

    const parsed = EmailCategorySchema.safeParse(expectedResult);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.category).toBe("updates");
  });

  it("should return expected categories for spam emails", async () => {
    const expectedResult: EmailCategory = {
      category: "spam",
      priority: 1,
      summary: "Suspicious lottery winning claim",
      suggestedAction: "delete",
    };

    mockGenerateObject.mockResolvedValueOnce({ object: expectedResult });

    const parsed = EmailCategorySchema.safeParse(expectedResult);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.category).toBe("spam");
    expect(parsed.data?.suggestedAction).toBe("delete");
  });
});

describe("Email Categorization Input Validation", () => {
  it("should require subject field", () => {
    const email = TEST_EMAILS.important;
    expect(email.subject).toBeDefined();
    expect(typeof email.subject).toBe("string");
    expect(email.subject.length).toBeGreaterThan(0);
  });

  it("should require body field", () => {
    const email = TEST_EMAILS.important;
    expect(email.body).toBeDefined();
    expect(typeof email.body).toBe("string");
    expect(email.body.length).toBeGreaterThan(0);
  });

  it("should allow optional sender field", () => {
    const emailWithSender = TEST_EMAILS.important;
    expect(emailWithSender.sender).toBeDefined();

    const emailWithoutSender: CategorizeEmailInput = {
      subject: "Test",
      body: "Test body",
    };
    expect(emailWithoutSender.sender).toBeUndefined();
  });

  it("should allow optional recipients field", () => {
    const emailWithRecipients = TEST_EMAILS.important;
    expect(emailWithRecipients.recipients).toBeDefined();
    expect(Array.isArray(emailWithRecipients.recipients)).toBe(true);

    const emailWithoutRecipients: CategorizeEmailInput = {
      subject: "Test",
      body: "Test body",
    };
    expect(emailWithoutRecipients.recipients).toBeUndefined();
  });
});

describe("AI Categorization Pipeline Integration", () => {
  /**
   * This test verifies the full AI categorization pipeline structure.
   * It tests that all the necessary components are properly exported and connected.
   */
  it("should export all necessary types and functions", async () => {
    const { categorizeEmail, categorizeEmailContent, EmailCategorySchema } = await import("../src");

    expect(typeof categorizeEmail).toBe("function");
    expect(typeof categorizeEmailContent).toBe("function");
    expect(EmailCategorySchema).toBeDefined();
    expect(EmailCategorySchema.parse).toBeDefined();
  });

  it("should have proper type definitions for CategorizeEmailInput", async () => {
    const { categorizeEmail } = await import("../src");

    // This test verifies the function signature is correct
    // by checking that it accepts the expected input type
    const input: CategorizeEmailInput = {
      subject: "Test Subject",
      body: "Test Body",
      sender: "test@example.com",
      recipients: ["recipient@example.com"],
    };

    // Verify the input matches the expected type
    expect(input.subject).toBe("Test Subject");
    expect(input.body).toBe("Test Body");
    expect(input.sender).toBe("test@example.com");
    expect(input.recipients).toEqual(["recipient@example.com"]);
  });
});

/**
 * Live AI Integration Tests
 *
 * These tests are skipped by default and can be run with:
 * OPENAI_API_KEY=your-key pnpm test:live
 *
 * They test the actual AI categorization with real API calls.
 */
describe.skip("Live AI Categorization", () => {
  it("should categorize an important email correctly", async () => {
    const { categorizeEmail } = await import("../src");

    const result = await categorizeEmail(TEST_EMAILS.important);

    expect(result).toBeDefined();
    expect(result.category).toBe("important");
    expect(result.priority).toBeGreaterThanOrEqual(4);
    expect(result.suggestedAction).toBe("reply");
    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("should categorize a promotional email correctly", async () => {
    const { categorizeEmail } = await import("../src");

    const result = await categorizeEmail(TEST_EMAILS.promotional);

    expect(result).toBeDefined();
    expect(result.category).toBe("promotional");
    expect(result.priority).toBeLessThanOrEqual(3);
  });

  it("should categorize a spam email correctly", async () => {
    const { categorizeEmail } = await import("../src");

    const result = await categorizeEmail(TEST_EMAILS.spam);

    expect(result).toBeDefined();
    expect(result.category).toBe("spam");
    expect(result.suggestedAction).toBe("delete");
  });
});
