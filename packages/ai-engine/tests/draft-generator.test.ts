import { describe, it, expect } from "vitest";
import { DraftGenerator } from "../src/pipeline/draft-generator";
import { MockProvider } from "./helpers/mock-provider";
import type { EmailIntent } from "@emaily/shared";

const provider = new MockProvider();
const generator = new DraftGenerator(provider);

function makeIntent(text: string, type: EmailIntent["type"] = "question", priority = 1): EmailIntent {
  return { type, text, priority };
}

function makeQAPair(id: string, triggers: string[], response: string) {
  return { id, triggerPatterns: triggers, idealResponse: response };
}

describe("DraftGenerator.matchQAPairs", () => {
  it("matches intent text to a trigger pattern", () => {
    const intents = [makeIntent("What are your business hours?")];
    const qaPairs = [
      makeQAPair("qa1", ["business hours", "opening times"], "We are open 9-5 M-F."),
    ];

    const result = generator.matchQAPairs(intents, qaPairs);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("qa1");
  });

  it("matches case-insensitively", () => {
    const intents = [makeIntent("WHAT ARE YOUR BUSINESS HOURS?")];
    const qaPairs = [
      makeQAPair("qa1", ["business hours"], "We are open 9-5 M-F."),
    ];

    const result = generator.matchQAPairs(intents, qaPairs);
    expect(result).toHaveLength(1);
  });

  it("returns empty when no matches", () => {
    const intents = [makeIntent("What is your refund policy?")];
    const qaPairs = [
      makeQAPair("qa1", ["business hours"], "We are open 9-5 M-F."),
    ];

    const result = generator.matchQAPairs(intents, qaPairs);
    expect(result).toHaveLength(0);
  });

  it("returns multiple matches", () => {
    const intents = [
      makeIntent("What are your business hours?"),
      makeIntent("What is the shipping policy?"),
    ];
    const qaPairs = [
      makeQAPair("qa1", ["business hours"], "We are open 9-5."),
      makeQAPair("qa2", ["shipping policy", "delivery"], "Free shipping over $50."),
      makeQAPair("qa3", ["refund"], "30-day refund policy."),
    ];

    const result = generator.matchQAPairs(intents, qaPairs);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["qa1", "qa2"]);
  });

  it("returns empty for empty intents", () => {
    const qaPairs = [makeQAPair("qa1", ["test"], "response")];

    const result = generator.matchQAPairs([], qaPairs);
    expect(result).toHaveLength(0);
  });

  it("returns empty for empty qaPairs", () => {
    const intents = [makeIntent("Some question")];

    const result = generator.matchQAPairs(intents, []);
    expect(result).toHaveLength(0);
  });

  it("returns empty when both are empty", () => {
    const result = generator.matchQAPairs([], []);
    expect(result).toHaveLength(0);
  });

  it("matches when trigger pattern is contained within intent text", () => {
    const intents = [makeIntent("Can you tell me about your pricing plans and discounts?")];
    const qaPairs = [
      makeQAPair("qa1", ["pricing plans"], "See our website for pricing."),
    ];

    const result = generator.matchQAPairs(intents, qaPairs);
    expect(result).toHaveLength(1);
  });

  it("matches when intent text is contained within trigger pattern", () => {
    const intents = [makeIntent("pricing")];
    const qaPairs = [
      makeQAPair("qa1", ["pricing plans and packages"], "See our website."),
    ];

    const result = generator.matchQAPairs(intents, qaPairs);
    expect(result).toHaveLength(1);
  });

  it("matches via any of the trigger patterns", () => {
    const intents = [makeIntent("What are your opening times?")];
    const qaPairs = [
      makeQAPair("qa1", ["business hours", "opening times", "schedule"], "We are open 9-5."),
    ];

    const result = generator.matchQAPairs(intents, qaPairs);
    expect(result).toHaveLength(1);
  });
});
