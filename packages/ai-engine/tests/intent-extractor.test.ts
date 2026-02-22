import { describe, it, expect } from "vitest";
import { IntentExtractor } from "../src/pipeline/intent-extractor";
import { MockProvider } from "./helpers/mock-provider";

const provider = new MockProvider();
const extractor = new IntentExtractor(provider);

describe("IntentExtractor.validateIntents", () => {
  it("passes through valid intents", () => {
    const raw = [
      { type: "question", text: "What is the deadline?", priority: 1 },
      { type: "request", text: "Please send the report.", priority: 2 },
      { type: "info", text: "Meeting moved to Friday.", priority: 3 },
    ];

    const result = extractor.validateIntents(raw);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "question", text: "What is the deadline?", priority: 1 });
    expect(result[1]).toEqual({ type: "request", text: "Please send the report.", priority: 2 });
    expect(result[2]).toEqual({ type: "info", text: "Meeting moved to Friday.", priority: 3 });
  });

  it("filters out invalid type", () => {
    const raw = [
      { type: "question", text: "Valid", priority: 1 },
      { type: "command", text: "Invalid type", priority: 1 },
      { type: "suggestion", text: "Also invalid", priority: 2 },
    ];

    const result = extractor.validateIntents(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("question");
  });

  it("filters out invalid priority (below 1 or above 3)", () => {
    const raw = [
      { type: "question", text: "Valid", priority: 2 },
      { type: "question", text: "Too low", priority: 0 },
      { type: "question", text: "Too high", priority: 4 },
      { type: "question", text: "Negative", priority: -1 },
    ];

    const result = extractor.validateIntents(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("Valid");
  });

  it("returns empty for non-array input", () => {
    expect(extractor.validateIntents("not an array")).toEqual([]);
    expect(extractor.validateIntents(null)).toEqual([]);
    expect(extractor.validateIntents(undefined)).toEqual([]);
    expect(extractor.validateIntents(42)).toEqual([]);
    expect(extractor.validateIntents({ intents: [] })).toEqual([]);
  });

  it("filters out intents with empty text", () => {
    const raw = [
      { type: "question", text: "", priority: 1 },
      { type: "request", text: "Has text", priority: 2 },
    ];

    const result = extractor.validateIntents(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("Has text");
  });

  it("enforces max 10 intents", () => {
    const raw = Array.from({ length: 15 }, (_, i) => ({
      type: "question",
      text: `Intent ${i}`,
      priority: 1,
    }));

    const result = extractor.validateIntents(raw);
    expect(result).toHaveLength(10);
  });

  it("truncates text to 500 chars", () => {
    const longText = "A".repeat(600);
    const raw = [{ type: "question", text: longText, priority: 1 }];

    const result = extractor.validateIntents(raw);
    expect(result[0]!.text).toHaveLength(500);
  });

  it("rounds fractional priority", () => {
    const raw = [{ type: "question", text: "Test", priority: 1.7 }];

    const result = extractor.validateIntents(raw);
    expect(result[0]!.priority).toBe(2);
  });

  it("filters out non-object items", () => {
    const raw = [
      "string",
      42,
      null,
      { type: "question", text: "Valid", priority: 1 },
    ];

    const result = extractor.validateIntents(raw);
    expect(result).toHaveLength(1);
  });

  it("filters out items with non-string type", () => {
    const raw = [
      { type: 123, text: "Test", priority: 1 },
      { type: "question", text: "Valid", priority: 1 },
    ];

    const result = extractor.validateIntents(raw);
    expect(result).toHaveLength(1);
  });

  it("filters out items with non-number priority", () => {
    const raw = [
      { type: "question", text: "Test", priority: "high" },
      { type: "question", text: "Valid", priority: 2 },
    ];

    const result = extractor.validateIntents(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("Valid");
  });
});

describe("IntentExtractor.buildThreadContext", () => {
  it("builds context from multiple previous emails", () => {
    const emails = [
      { from: "alice@test.com", body: "First message content", date: new Date("2025-01-01") },
      { from: "bob@test.com", body: "Reply message content", date: new Date("2025-01-02") },
    ];

    const result = extractor.buildThreadContext(emails);

    expect(result).toContain("[alice@test.com]");
    expect(result).toContain("[bob@test.com]");
    expect(result).toContain("First message content");
    expect(result).toContain("Reply message content");
  });

  it("returns empty string for empty array", () => {
    const result = extractor.buildThreadContext([]);
    expect(result).toBe("");
  });

  it("limits to last 5 emails", () => {
    const emails = Array.from({ length: 8 }, (_, i) => ({
      from: `user${i}@test.com`,
      body: `Body ${i}`,
      date: new Date(2025, 0, i + 1),
    }));

    const result = extractor.buildThreadContext(emails);

    // Should not contain first 3 emails (indices 0,1,2)
    expect(result).not.toContain("[user0@test.com]");
    expect(result).not.toContain("[user1@test.com]");
    expect(result).not.toContain("[user2@test.com]");
    // Should contain last 5 (indices 3-7)
    expect(result).toContain("[user3@test.com]");
    expect(result).toContain("[user7@test.com]");
  });

  it("truncates body preview to 200 chars", () => {
    const emails = [
      { from: "alice@test.com", body: "X".repeat(300), date: new Date("2025-01-01") },
    ];

    const result = extractor.buildThreadContext(emails);

    // The body preview is 200 chars max, so total line should be short
    expect(result).toContain("[alice@test.com]:");
    // The actual body portion should be at most 200 chars of X's
    const bodyPart = result.split(": ")[1]!;
    expect(bodyPart.length).toBeLessThanOrEqual(200);
  });

  it("truncates combined output to ~1000 chars", () => {
    const emails = Array.from({ length: 5 }, (_, i) => ({
      from: `user${i}@test.com`,
      body: "A".repeat(250),
      date: new Date(2025, 0, i + 1),
    }));

    const result = extractor.buildThreadContext(emails);

    // Should be truncated to 1000 + "..." = 1003
    expect(result.length).toBeLessThanOrEqual(1003);
    expect(result.endsWith("...")).toBe(true);
  });

  it("replaces newlines in body preview with spaces", () => {
    const emails = [
      { from: "alice@test.com", body: "Line one\nLine two\nLine three", date: new Date("2025-01-01") },
    ];

    const result = extractor.buildThreadContext(emails);

    expect(result).toContain("Line one Line two Line three");
    expect(result).not.toContain("Line one\n");
  });
});
