import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { setupTestDatabase, teardownTestDatabase } from "./setup";

let prisma: PrismaClient;

describe("Database Models", () => {
  beforeAll(async () => {
    prisma = await setupTestDatabase();
  }, 120000); // 2 minute timeout for container startup

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe("Team and User", () => {
    it("creates a team", async () => {
      const team = await prisma.team.create({
        data: {
          name: "Test Team",
        },
      });

      expect(team.id).toBeDefined();
      expect(team.name).toBe("Test Team");
      expect(team.createdAt).toBeInstanceOf(Date);
    });

    it("creates a user in a team", async () => {
      const team = await prisma.team.create({
        data: { name: "User Test Team" },
      });

      const user = await prisma.user.create({
        data: {
          email: "test@example.com",
          name: "Test User",
          passwordHash: "hashed_password_here",
          teamId: team.id,
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.teamId).toBe(team.id);
      expect(user.role).toBe("member"); // default role
      expect(user.totpEnabled).toBe(false);
    });

    it("enforces unique email constraint", async () => {
      const team = await prisma.team.create({
        data: { name: "Unique Email Team" },
      });

      await prisma.user.create({
        data: {
          email: "unique@example.com",
          name: "First User",
          passwordHash: "hash1",
          teamId: team.id,
        },
      });

      await expect(
        prisma.user.create({
          data: {
            email: "unique@example.com",
            name: "Second User",
            passwordHash: "hash2",
            teamId: team.id,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Mailbox", () => {
    it("creates a mailbox with access", async () => {
      const team = await prisma.team.create({
        data: { name: "Mailbox Test Team" },
      });

      const user = await prisma.user.create({
        data: {
          email: "mailbox-user@example.com",
          name: "Mailbox User",
          passwordHash: "hashed",
          teamId: team.id,
        },
      });

      const mailbox = await prisma.mailbox.create({
        data: {
          emailAddress: "info@company.com",
          displayName: "Company Info",
          type: "shared",
          teamId: team.id,
          access: {
            create: {
              userId: user.id,
              permission: "admin",
            },
          },
        },
        include: { access: true },
      });

      expect(mailbox.emailAddress).toBe("info@company.com");
      expect(mailbox.type).toBe("shared");
      expect(mailbox.access).toHaveLength(1);
      expect(mailbox.access[0].permission).toBe("admin");
      expect(mailbox.access[0].userId).toBe(user.id);
    });

    it("supports IMAP/SMTP configuration", async () => {
      const team = await prisma.team.create({
        data: { name: "IMAP Team" },
      });

      const mailbox = await prisma.mailbox.create({
        data: {
          emailAddress: "mail@example.com",
          teamId: team.id,
          imapHost: "imap.example.com",
          imapPort: 993,
          imapUser: "mail@example.com",
          imapPasswordEnc: "encrypted_password",
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          smtpUser: "mail@example.com",
          smtpPasswordEnc: "encrypted_password",
        },
      });

      expect(mailbox.imapHost).toBe("imap.example.com");
      expect(mailbox.imapPort).toBe(993);
      expect(mailbox.smtpHost).toBe("smtp.example.com");
      expect(mailbox.smtpPort).toBe(587);
    });
  });

  describe("Thread and Email", () => {
    it("creates a thread with emails", async () => {
      const team = await prisma.team.create({
        data: { name: "Thread Test Team" },
      });

      const mailbox = await prisma.mailbox.create({
        data: {
          emailAddress: "threads@example.com",
          teamId: team.id,
        },
      });

      const thread = await prisma.thread.create({
        data: {
          mailboxId: mailbox.id,
          teamId: team.id,
          subject: "Test Thread Subject",
          emails: {
            create: {
              messageId: "<test-123@example.com>",
              subject: "Test Email",
              bodyText: "Hello, this is a test email.",
              fromAddress: "sender@example.com",
              fromName: "Sender Name",
              toAddresses: ["threads@example.com"],
              date: new Date(),
            },
          },
        },
        include: { emails: true },
      });

      expect(thread.subject).toBe("Test Thread Subject");
      expect(thread.status).toBe("open");
      expect(thread.hasSentReply).toBe(false);
      expect(thread.emails).toHaveLength(1);
      expect(thread.emails[0].bodyText).toBe("Hello, this is a test email.");
      expect(thread.emails[0].fromAddress).toBe("sender@example.com");
    });

    it("supports email threading via In-Reply-To", async () => {
      const team = await prisma.team.create({
        data: { name: "Reply Thread Team" },
      });

      const mailbox = await prisma.mailbox.create({
        data: {
          emailAddress: "replies@example.com",
          teamId: team.id,
        },
      });

      const thread = await prisma.thread.create({
        data: {
          mailboxId: mailbox.id,
          teamId: team.id,
          subject: "Original Subject",
        },
      });

      // Original email
      const original = await prisma.email.create({
        data: {
          threadId: thread.id,
          messageId: "<original-123@example.com>",
          subject: "Original Subject",
          bodyText: "Original message",
          fromAddress: "sender@example.com",
          toAddresses: ["replies@example.com"],
          date: new Date(),
        },
      });

      // Reply email
      const reply = await prisma.email.create({
        data: {
          threadId: thread.id,
          messageId: "<reply-456@example.com>",
          inReplyTo: "<original-123@example.com>",
          references: ["<original-123@example.com>"],
          subject: "Re: Original Subject",
          bodyText: "This is a reply",
          fromAddress: "replies@example.com",
          toAddresses: ["sender@example.com"],
          date: new Date(),
          isSent: true,
        },
      });

      expect(reply.inReplyTo).toBe("<original-123@example.com>");
      expect(reply.references).toContain("<original-123@example.com>");
      expect(reply.isSent).toBe(true);
    });
  });

  describe("Tags", () => {
    it("creates tags and applies to threads", async () => {
      const team = await prisma.team.create({
        data: { name: "Tag Test Team" },
      });

      const mailbox = await prisma.mailbox.create({
        data: {
          emailAddress: "tags@example.com",
          teamId: team.id,
        },
      });

      const thread = await prisma.thread.create({
        data: {
          mailboxId: mailbox.id,
          teamId: team.id,
          subject: "Tagged Thread",
        },
      });

      const tag = await prisma.tag.create({
        data: {
          teamId: team.id,
          name: "Urgent",
          color: "#ef4444",
          aiAction: "notify",
        },
      });

      const threadTag = await prisma.threadTag.create({
        data: {
          threadId: thread.id,
          tagId: tag.id,
          appliedBy: "manual",
        },
      });

      expect(tag.name).toBe("Urgent");
      expect(tag.aiAction).toBe("notify");
      expect(threadTag.appliedBy).toBe("manual");
    });
  });

  describe("Collaboration", () => {
    it("creates comments on threads", async () => {
      const team = await prisma.team.create({
        data: { name: "Comment Team" },
      });

      const user = await prisma.user.create({
        data: {
          email: "commenter@example.com",
          name: "Commenter",
          passwordHash: "hash",
          teamId: team.id,
        },
      });

      const mailbox = await prisma.mailbox.create({
        data: {
          emailAddress: "comments@example.com",
          teamId: team.id,
        },
      });

      const thread = await prisma.thread.create({
        data: {
          mailboxId: mailbox.id,
          teamId: team.id,
          subject: "Thread with comments",
        },
      });

      const comment = await prisma.comment.create({
        data: {
          threadId: thread.id,
          userId: user.id,
          content: "This needs follow-up",
        },
      });

      expect(comment.content).toBe("This needs follow-up");
      expect(comment.userId).toBe(user.id);
      expect(comment.threadId).toBe(thread.id);
    });

    it("creates assignments", async () => {
      const team = await prisma.team.create({
        data: { name: "Assignment Team" },
      });

      const assigner = await prisma.user.create({
        data: {
          email: "assigner@example.com",
          name: "Assigner",
          passwordHash: "hash",
          teamId: team.id,
          role: "admin",
        },
      });

      const assignee = await prisma.user.create({
        data: {
          email: "assignee@example.com",
          name: "Assignee",
          passwordHash: "hash",
          teamId: team.id,
        },
      });

      const mailbox = await prisma.mailbox.create({
        data: {
          emailAddress: "assignments@example.com",
          teamId: team.id,
        },
      });

      const thread = await prisma.thread.create({
        data: {
          mailboxId: mailbox.id,
          teamId: team.id,
          subject: "Assigned Thread",
        },
      });

      const assignment = await prisma.assignment.create({
        data: {
          threadId: thread.id,
          assignedToId: assignee.id,
          assignedById: assigner.id,
          status: "open",
          note: "Please handle this",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
        },
      });

      expect(assignment.status).toBe("open");
      expect(assignment.note).toBe("Please handle this");
      expect(assignment.assignedToId).toBe(assignee.id);
      expect(assignment.assignedById).toBe(assigner.id);
    });
  });
});
