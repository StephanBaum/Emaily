import { describe, it, expect } from "vitest";
import { UnifiedThreadProcessor } from "../src/pipeline/unified-thread-processor";
import { MockProvider } from "./helpers/mock-provider";
import type { UnifiedProcessOptions } from "../src/pipeline/unified-thread-processor";

function makeOptions(overrides: Partial<UnifiedProcessOptions> = {}): UnifiedProcessOptions {
  return {
    subject: "Test Thread",
    emails: [
      {
        from: "sender@test.com",
        body: "Hello, what are your office hours?",
        date: new Date("2025-01-15"),
        isSent: false,
      },
    ],
    availableTags: [
      { name: "Support" },
      { name: "Billing" },
      { name: "Sales" },
    ],
    qaPairs: [],
    generateDraft: true,
    replyTo: "reply@test.com",
    ...overrides,
  };
}

describe("UnifiedThreadProcessor.processThread", () => {
  it("parses a valid response correctly", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [
        { name: "Support", confidence: 0.9 },
        { name: "Billing", confidence: 0.7 },
      ],
      intents: [
        { type: "question", text: "What are the office hours?", priority: 1 },
      ],
      draft: {
        subject: "Re: Test Thread",
        body: "Our office hours are 9-5 M-F.",
        confidence: {
          overall: 0.85,
          intentCoverage: 0.9,
          qaMatchStrength: 0.7,
          ragRelevance: 0.0,
          toneConsistency: 0.8,
        },
      },
    });

    const result = await processor.processThread(makeOptions());

    expect(result.tags).toHaveLength(2);
    expect(result.tags[0]).toEqual({ name: "Support", confidence: 0.9 });
    expect(result.tags[1]).toEqual({ name: "Billing", confidence: 0.7 });

    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]!.type).toBe("question");
    expect(result.intents[0]!.text).toBe("What are the office hours?");

    expect(result.draft).not.toBeNull();
    expect(result.draft!.subject).toBe("Re: Test Thread");
    expect(result.draft!.body).toBe("Our office hours are 9-5 M-F.");
    expect(result.draft!.confidence.overall).toBe(0.85);
  });

  it("returns empty result for invalid JSON", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = "not valid json {{{";

    const result = await processor.processThread(makeOptions());

    expect(result.tags).toEqual([]);
    expect(result.intents).toEqual([]);
    expect(result.draft).toBeNull();
  });

  it("filters out tags not in the available set", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [
        { name: "Support", confidence: 0.9 },
        { name: "Unknown", confidence: 0.8 },
        { name: "Sales", confidence: 0.6 },
      ],
      intents: [],
      draft: null,
    });

    const result = await processor.processThread(makeOptions());

    expect(result.tags).toHaveLength(2);
    expect(result.tags.map((t) => t.name)).toEqual(["Support", "Sales"]);
  });

  it("filters out tags with confidence < 0.5", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [
        { name: "Support", confidence: 0.9 },
        { name: "Billing", confidence: 0.3 },
        { name: "Sales", confidence: 0.49 },
      ],
      intents: [],
      draft: null,
    });

    const result = await processor.processThread(makeOptions());

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]!.name).toBe("Support");
  });

  it("filters out invalid intent types", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [],
      intents: [
        { type: "question", text: "Valid", priority: 1 },
        { type: "command", text: "Invalid type", priority: 1 },
        { type: "request", text: "Also valid", priority: 2 },
      ],
      draft: null,
    });

    const result = await processor.processThread(makeOptions());

    expect(result.intents).toHaveLength(2);
    expect(result.intents[0]!.type).toBe("question");
    expect(result.intents[1]!.type).toBe("request");
  });

  it("returns null draft when body is empty", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [],
      intents: [],
      draft: {
        subject: "Re: Test",
        body: "",
        confidence: { overall: 0.5 },
      },
    });

    const result = await processor.processThread(makeOptions());
    expect(result.draft).toBeNull();
  });

  it("returns null draft when body is whitespace only", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [],
      intents: [],
      draft: {
        subject: "Re: Test",
        body: "   \n  ",
        confidence: { overall: 0.5 },
      },
    });

    const result = await processor.processThread(makeOptions());
    expect(result.draft).toBeNull();
  });

  it("returns null draft when draft is explicitly null", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [],
      intents: [],
      draft: null,
    });

    const result = await processor.processThread(makeOptions());
    expect(result.draft).toBeNull();
  });

  it("handles missing tags/intents arrays gracefully", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({});

    const result = await processor.processThread(makeOptions());

    expect(result.tags).toEqual([]);
    expect(result.intents).toEqual([]);
    expect(result.draft).toBeNull();
  });

  it("clamps confidence values to 0-1 range", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [{ name: "Support", confidence: 1.5 }],
      intents: [],
      draft: {
        subject: "Re: Test",
        body: "Response body.",
        confidence: {
          overall: 2.0,
          intentCoverage: -0.5,
          qaMatchStrength: 0.7,
          ragRelevance: 0.0,
          toneConsistency: 0.9,
        },
      },
    });

    const result = await processor.processThread(makeOptions());

    expect(result.tags[0]!.confidence).toBe(1);
    expect(result.draft!.confidence.overall).toBe(1);
    expect(result.draft!.confidence.intentCoverage).toBe(0);
  });

  it("tag name matching is case-insensitive", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    provider.nextResponse = JSON.stringify({
      tags: [
        { name: "support", confidence: 0.9 },
        { name: "BILLING", confidence: 0.8 },
      ],
      intents: [],
      draft: null,
    });

    const result = await processor.processThread(makeOptions());

    expect(result.tags).toHaveLength(2);
  });

  it("limits intents to max 10", async () => {
    const provider = new MockProvider();
    const processor = new UnifiedThreadProcessor(provider);

    const intents = Array.from({ length: 15 }, (_, i) => ({
      type: "question",
      text: `Question ${i}`,
      priority: 1,
    }));

    provider.nextResponse = JSON.stringify({
      tags: [],
      intents,
      draft: null,
    });

    const result = await processor.processThread(makeOptions());
    expect(result.intents).toHaveLength(10);
  });
});
