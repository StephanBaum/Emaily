import { describe, it, expect } from "vitest";
import {
  matchEmailToThread,
  normalizeSubject,
  buildThreadChain,
  extractParticipants,
  isLikelyBot,
} from "../src/thread-matcher";

describe("Thread Matcher", () => {
  describe("normalizeSubject", () => {
    it("removes Re: prefix", () => {
      expect(normalizeSubject("Re: Hello")).toBe("hello");
      expect(normalizeSubject("RE: Hello")).toBe("hello");
      expect(normalizeSubject("re: Hello")).toBe("hello");
    });

    it("removes Fwd: prefix", () => {
      expect(normalizeSubject("Fwd: Hello")).toBe("hello");
      expect(normalizeSubject("FWD: Hello")).toBe("hello");
      expect(normalizeSubject("Fw: Hello")).toBe("hello");
    });

    it("removes multiple prefixes", () => {
      expect(normalizeSubject("Re: Re: Fwd: Hello")).toBe("hello");
      expect(normalizeSubject("Fwd: Re: Re: Hello")).toBe("hello");
    });

    it("removes [tag] prefixes", () => {
      expect(normalizeSubject("[URGENT] Hello")).toBe("hello");
      expect(normalizeSubject("[Team] Re: Hello")).toBe("hello");
    });

    it("normalizes whitespace", () => {
      expect(normalizeSubject("  Hello   World  ")).toBe("hello world");
    });

    it("handles empty subject", () => {
      expect(normalizeSubject("")).toBe("");
      expect(normalizeSubject("Re:")).toBe("");
    });

    it("handles international prefixes", () => {
      expect(normalizeSubject("Aw: German Reply")).toBe("german reply");
      expect(normalizeSubject("Sv: Swedish Reply")).toBe("swedish reply");
      expect(normalizeSubject("Antw: Dutch Reply")).toBe("dutch reply");
    });
  });

  describe("matchEmailToThread", () => {
    const existingThreads = [
      {
        id: "thread-1",
        messageIds: ["<msg-1@example.com>", "<msg-2@example.com>"],
        subject: "Project Update",
      },
      {
        id: "thread-2",
        messageIds: ["<msg-3@example.com>"],
        subject: "Meeting Tomorrow",
      },
    ];

    it("matches by In-Reply-To header", () => {
      const result = matchEmailToThread(
        {
          messageId: "<msg-4@example.com>",
          inReplyTo: "<msg-1@example.com>",
          references: [],
          subject: "Re: Project Update",
          fromAddress: "user@example.com",
          toAddresses: ["team@example.com"],
          date: new Date(),
        },
        existingThreads
      );

      expect(result.threadId).toBe("thread-1");
      expect(result.matchType).toBe("in-reply-to");
      expect(result.confidence).toBe(1.0);
    });

    it("matches by References header", () => {
      const result = matchEmailToThread(
        {
          messageId: "<msg-5@example.com>",
          inReplyTo: null,
          references: ["<msg-3@example.com>"],
          subject: "Re: Meeting Tomorrow",
          fromAddress: "user@example.com",
          toAddresses: ["team@example.com"],
          date: new Date(),
        },
        existingThreads
      );

      expect(result.threadId).toBe("thread-2");
      expect(result.matchType).toBe("references");
      expect(result.confidence).toBe(0.95);
    });

    it("matches by subject when no header match", () => {
      const result = matchEmailToThread(
        {
          messageId: "<msg-6@example.com>",
          inReplyTo: null,
          references: [],
          subject: "Re: Project Update",
          fromAddress: "user@example.com",
          toAddresses: ["team@example.com"],
          date: new Date(),
        },
        existingThreads
      );

      expect(result.threadId).toBe("thread-1");
      expect(result.matchType).toBe("subject");
      expect(result.confidence).toBe(0.7);
    });

    it("returns no match for new conversation", () => {
      const result = matchEmailToThread(
        {
          messageId: "<msg-7@example.com>",
          inReplyTo: null,
          references: [],
          subject: "New Topic",
          fromAddress: "user@example.com",
          toAddresses: ["team@example.com"],
          date: new Date(),
        },
        existingThreads
      );

      expect(result.threadId).toBeNull();
      expect(result.matchType).toBe("none");
      expect(result.confidence).toBe(0);
    });

    it("prefers In-Reply-To over References", () => {
      const result = matchEmailToThread(
        {
          messageId: "<msg-8@example.com>",
          inReplyTo: "<msg-1@example.com>", // Points to thread-1
          references: ["<msg-3@example.com>"], // Points to thread-2
          subject: "Re: Mixed",
          fromAddress: "user@example.com",
          toAddresses: ["team@example.com"],
          date: new Date(),
        },
        existingThreads
      );

      expect(result.threadId).toBe("thread-1");
      expect(result.matchType).toBe("in-reply-to");
    });
  });

  describe("buildThreadChain", () => {
    it("builds chain from root to leaves", () => {
      const emails = [
        { messageId: "<msg-1>", inReplyTo: null, date: new Date("2024-01-01") },
        { messageId: "<msg-2>", inReplyTo: "<msg-1>", date: new Date("2024-01-02") },
        { messageId: "<msg-3>", inReplyTo: "<msg-2>", date: new Date("2024-01-03") },
      ];

      const chain = buildThreadChain(emails);
      expect(chain).toEqual(["<msg-1>", "<msg-2>", "<msg-3>"]);
    });

    it("handles multiple branches", () => {
      const emails = [
        { messageId: "<msg-1>", inReplyTo: null, date: new Date("2024-01-01") },
        { messageId: "<msg-2>", inReplyTo: "<msg-1>", date: new Date("2024-01-02") },
        { messageId: "<msg-3>", inReplyTo: "<msg-1>", date: new Date("2024-01-03") },
      ];

      const chain = buildThreadChain(emails);
      expect(chain).toContain("<msg-1>");
      expect(chain).toContain("<msg-2>");
      expect(chain).toContain("<msg-3>");
      expect(chain.indexOf("<msg-1>")).toBe(0); // Root first
    });

    it("handles orphaned messages", () => {
      const emails = [
        { messageId: "<msg-1>", inReplyTo: null, date: new Date("2024-01-01") },
        { messageId: "<msg-2>", inReplyTo: "<missing>", date: new Date("2024-01-02") },
      ];

      const chain = buildThreadChain(emails);
      expect(chain).toContain("<msg-1>");
      expect(chain).toContain("<msg-2>");
    });
  });

  describe("extractParticipants", () => {
    it("extracts unique participants", () => {
      const emails = [
        {
          fromAddress: "alice@example.com",
          toAddresses: ["bob@example.com", "charlie@example.com"],
        },
        {
          fromAddress: "bob@example.com",
          toAddresses: ["alice@example.com"],
        },
      ];

      const participants = extractParticipants(emails);
      expect(participants).toHaveLength(3);
      expect(participants).toContain("alice@example.com");
      expect(participants).toContain("bob@example.com");
      expect(participants).toContain("charlie@example.com");
    });

    it("normalizes to lowercase", () => {
      const emails = [
        {
          fromAddress: "Alice@Example.COM",
          toAddresses: ["BOB@example.com"],
        },
      ];

      const participants = extractParticipants(emails);
      expect(participants).toContain("alice@example.com");
      expect(participants).toContain("bob@example.com");
    });

    it("includes CC addresses", () => {
      const emails = [
        {
          fromAddress: "alice@example.com",
          toAddresses: ["bob@example.com"],
          ccAddresses: ["charlie@example.com"],
        },
      ];

      const participants = extractParticipants(emails);
      expect(participants).toContain("charlie@example.com");
    });
  });

  describe("isLikelyBot", () => {
    it("detects noreply addresses", () => {
      expect(isLikelyBot({ fromAddress: "noreply@example.com", subject: "Hi" })).toBe(true);
      expect(isLikelyBot({ fromAddress: "no-reply@example.com", subject: "Hi" })).toBe(true);
      expect(isLikelyBot({ fromAddress: "donotreply@example.com", subject: "Hi" })).toBe(true);
    });

    it("detects notification addresses", () => {
      expect(isLikelyBot({ fromAddress: "notifications@github.com", subject: "Hi" })).toBe(true);
      expect(isLikelyBot({ fromAddress: "alerts@service.com", subject: "Hi" })).toBe(true);
    });

    it("detects system addresses", () => {
      expect(isLikelyBot({ fromAddress: "mailer-daemon@example.com", subject: "Hi" })).toBe(true);
      expect(isLikelyBot({ fromAddress: "postmaster@example.com", subject: "Hi" })).toBe(true);
    });

    it("detects bot headers", () => {
      expect(
        isLikelyBot({
          fromAddress: "user@example.com",
          subject: "Hi",
          headers: { "auto-submitted": "auto-generated" },
        })
      ).toBe(true);

      expect(
        isLikelyBot({
          fromAddress: "user@example.com",
          subject: "Hi",
          headers: { precedence: "bulk" },
        })
      ).toBe(true);
    });

    it("returns false for normal emails", () => {
      expect(
        isLikelyBot({
          fromAddress: "alice@example.com",
          subject: "Hello!",
        })
      ).toBe(false);
    });
  });
});
