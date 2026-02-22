import { describe, it, expect } from "vitest";
import { AutoTagger } from "../src/pipeline/auto-tagger";
import { MockProvider } from "./helpers/mock-provider";

const provider = new MockProvider();
const tagger = new AutoTagger(provider);

function makeEmail(overrides: Partial<{ subject: string; from: string; to: string[]; body: string }> = {}) {
  return {
    subject: overrides.subject ?? "Test Subject",
    from: overrides.from ?? "alice@example.com",
    to: overrides.to ?? ["bob@example.com"],
    body: overrides.body ?? "Hello, this is a test email body.",
  };
}

function makeTag(
  id: string,
  name: string,
  autoRules: { logic: "AND" | "OR"; conditions: { field: string; operator: string; value: string }[] } | null = null
) {
  return { id, name, color: "#000", autoRules };
}

describe("AutoTagger.evaluateRules", () => {
  it("matches a subject-contains rule", () => {
    const email = makeEmail({ subject: "Invoice #1234 attached" });
    const tags = [
      makeTag("t1", "Billing", {
        logic: "AND",
        conditions: [{ field: "subject", operator: "contains", value: "invoice" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      tagId: "t1",
      name: "Billing",
      confidence: 1.0,
      appliedBy: "auto",
    });
  });

  it("matches a from-equals rule", () => {
    const email = makeEmail({ from: "ceo@company.com" });
    const tags = [
      makeTag("t1", "VIP", {
        logic: "AND",
        conditions: [{ field: "from", operator: "equals", value: "ceo@company.com" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.tagId).toBe("t1");
  });

  it("handles AND logic: all conditions must match", () => {
    const email = makeEmail({ subject: "Urgent: Invoice", from: "billing@vendor.com" });
    const tags = [
      makeTag("t1", "UrgentBilling", {
        logic: "AND",
        conditions: [
          { field: "subject", operator: "contains", value: "urgent" },
          { field: "from", operator: "endsWith", value: "@vendor.com" },
        ],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("AND logic fails when one condition does not match", () => {
    const email = makeEmail({ subject: "Urgent: Invoice", from: "alice@example.com" });
    const tags = [
      makeTag("t1", "UrgentBilling", {
        logic: "AND",
        conditions: [
          { field: "subject", operator: "contains", value: "urgent" },
          { field: "from", operator: "endsWith", value: "@vendor.com" },
        ],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(0);
  });

  it("handles OR logic: any condition can match", () => {
    const email = makeEmail({ subject: "Hello", from: "billing@vendor.com" });
    const tags = [
      makeTag("t1", "Flagged", {
        logic: "OR",
        conditions: [
          { field: "subject", operator: "contains", value: "urgent" },
          { field: "from", operator: "endsWith", value: "@vendor.com" },
        ],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("returns no matches when tag has no autoRules", () => {
    const email = makeEmail();
    const tags = [makeTag("t1", "NoRules", null)];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(0);
  });

  it("returns no matches for empty conditions array", () => {
    const email = makeEmail();
    const tags = [makeTag("t1", "EmptyRules", { logic: "AND", conditions: [] })];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(0);
  });

  it("matches case-insensitively", () => {
    const email = makeEmail({ subject: "URGENT REQUEST" });
    const tags = [
      makeTag("t1", "Urgent", {
        logic: "AND",
        conditions: [{ field: "subject", operator: "contains", value: "urgent request" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("matches regex with the 'matches' operator", () => {
    const email = makeEmail({ subject: "Order #12345 confirmed" });
    const tags = [
      makeTag("t1", "Orders", {
        logic: "AND",
        conditions: [{ field: "subject", operator: "matches", value: "order\\s*#\\d+" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("handles invalid regex gracefully (returns false)", () => {
    const email = makeEmail({ subject: "test" });
    const tags = [
      makeTag("t1", "Bad", {
        logic: "AND",
        conditions: [{ field: "subject", operator: "matches", value: "[invalid(" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(0);
  });

  it("matches startsWith operator", () => {
    const email = makeEmail({ from: "support@helpdesk.com" });
    const tags = [
      makeTag("t1", "Support", {
        logic: "AND",
        conditions: [{ field: "from", operator: "startsWith", value: "support@" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("matches endsWith operator", () => {
    const email = makeEmail({ from: "anyone@internal.org" });
    const tags = [
      makeTag("t1", "Internal", {
        logic: "AND",
        conditions: [{ field: "from", operator: "endsWith", value: "@internal.org" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("matches body field", () => {
    const email = makeEmail({ body: "Please find the attached report." });
    const tags = [
      makeTag("t1", "Attachment", {
        logic: "AND",
        conditions: [{ field: "body", operator: "contains", value: "attached" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("matches to field (joined)", () => {
    const email = makeEmail({ to: ["team@company.com", "boss@company.com"] });
    const tags = [
      makeTag("t1", "TeamEmail", {
        logic: "AND",
        conditions: [{ field: "to", operator: "contains", value: "team@company.com" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(1);
  });

  it("returns empty for unknown field", () => {
    const email = makeEmail();
    const tags = [
      makeTag("t1", "Unknown", {
        logic: "AND",
        conditions: [{ field: "cc" as any, operator: "contains", value: "test" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(0);
  });

  it("returns empty for no tags", () => {
    const email = makeEmail();
    const matches = tagger.evaluateRules(email, []);
    expect(matches).toHaveLength(0);
  });

  it("matches multiple tags independently", () => {
    const email = makeEmail({ subject: "Urgent Invoice", from: "billing@vendor.com" });
    const tags = [
      makeTag("t1", "Urgent", {
        logic: "AND",
        conditions: [{ field: "subject", operator: "contains", value: "urgent" }],
      }),
      makeTag("t2", "Billing", {
        logic: "AND",
        conditions: [{ field: "subject", operator: "contains", value: "invoice" }],
      }),
      makeTag("t3", "NoMatch", {
        logic: "AND",
        conditions: [{ field: "subject", operator: "contains", value: "shipping" }],
      }),
    ];

    const matches = tagger.evaluateRules(email, tags);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.name)).toEqual(["Urgent", "Billing"]);
  });
});
