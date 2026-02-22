import { describe, it, expect } from "vitest";
import { buildAutoTagPrompt } from "../src/prompts/auto-tag";
import { buildUnifiedThreadPrompt } from "../src/prompts/unified-thread";

describe("buildAutoTagPrompt", () => {
  const email = {
    subject: "Invoice #1234",
    from: "billing@vendor.com",
    to: ["finance@company.com"],
    body: "Please find the invoice attached.",
  };

  const tags = [
    { name: "Billing", color: "#ff0000" },
    { name: "Support", color: "#00ff00" },
  ];

  it("returns exactly 2 messages", () => {
    const messages = buildAutoTagPrompt(email, tags);
    expect(messages).toHaveLength(2);
  });

  it("first message is system role, second is user role", () => {
    const messages = buildAutoTagPrompt(email, tags);
    expect(messages[0]!.role).toBe("system");
    expect(messages[1]!.role).toBe("user");
  });

  it("system message contains tag names", () => {
    const messages = buildAutoTagPrompt(email, tags);
    expect(messages[0]!.content).toContain("Billing");
    expect(messages[0]!.content).toContain("Support");
  });

  it("user message contains email subject", () => {
    const messages = buildAutoTagPrompt(email, tags);
    expect(messages[1]!.content).toContain("Invoice #1234");
  });

  it("user message contains email from", () => {
    const messages = buildAutoTagPrompt(email, tags);
    expect(messages[1]!.content).toContain("billing@vendor.com");
  });

  it("user message contains email body", () => {
    const messages = buildAutoTagPrompt(email, tags);
    expect(messages[1]!.content).toContain("Please find the invoice attached.");
  });

  it("user message contains email recipients", () => {
    const messages = buildAutoTagPrompt(email, tags);
    expect(messages[1]!.content).toContain("finance@company.com");
  });
});

describe("buildUnifiedThreadPrompt", () => {
  const baseOptions = {
    subject: "Project Update",
    emails: [
      {
        from: "alice@test.com",
        body: "Here is the project update for Q1.",
        date: new Date("2025-01-15"),
        isSent: false,
      },
      {
        from: "bob@test.com",
        body: "Thanks for the update. Any questions?",
        date: new Date("2025-01-16"),
        isSent: true,
      },
    ],
    availableTags: [
      { name: "Project", description: "Project related" },
      { name: "Update", aiAction: "none" },
    ],
    qaPairs: [] as { triggerPatterns: string[]; idealResponse: string }[],
    generateDraft: true,
    replyTo: "bob@test.com",
  };

  it("returns exactly 2 messages", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    expect(messages).toHaveLength(2);
  });

  it("first message is system role, second is user role", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    expect(messages[0]!.role).toBe("system");
    expect(messages[1]!.role).toBe("user");
  });

  it("system message contains available tag names", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    expect(messages[0]!.content).toContain("Project");
    expect(messages[0]!.content).toContain("Update");
  });

  it("user message contains the subject", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    expect(messages[1]!.content).toContain("Project Update");
  });

  it("user message includes thread emails", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    expect(messages[1]!.content).toContain("alice@test.com");
    expect(messages[1]!.content).toContain("Here is the project update for Q1.");
    expect(messages[1]!.content).toContain("bob@test.com");
    expect(messages[1]!.content).toContain("Thanks for the update.");
  });

  it("marks sent emails with [SENT] and received with [RECEIVED]", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    const userContent = messages[1]!.content;
    expect(userContent).toContain("[RECEIVED]");
    expect(userContent).toContain("[SENT]");
  });

  it("system message mentions draft generation when generateDraft is true", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    expect(messages[0]!.content).toContain("DRAFT");
    expect(messages[0]!.content).toContain("bob@test.com");
  });

  it("system message sets draft to null when generateDraft is false", () => {
    const messages = buildUnifiedThreadPrompt({ ...baseOptions, generateDraft: false });
    expect(messages[0]!.content).toContain("draft generation not requested");
  });

  it("includes Q&A pairs when provided", () => {
    const options = {
      ...baseOptions,
      qaPairs: [
        { triggerPatterns: ["project timeline"], idealResponse: "Q1 ends March 31." },
      ],
    };

    const messages = buildUnifiedThreadPrompt(options);
    expect(messages[0]!.content).toContain("Q&A Knowledge Base");
    expect(messages[0]!.content).toContain("project timeline");
    expect(messages[0]!.content).toContain("Q1 ends March 31.");
  });

  it("includes agent personality when provided", () => {
    const options = {
      ...baseOptions,
      agentPersonality: "Be professional and concise.",
    };

    const messages = buildUnifiedThreadPrompt(options);
    expect(messages[0]!.content).toContain("Be professional and concise.");
  });

  it("includes tag descriptions when provided", () => {
    const messages = buildUnifiedThreadPrompt(baseOptions);
    expect(messages[0]!.content).toContain("Project related");
  });
});
