import { PrismaClient } from "@prisma/client";
import { hashPassword, encrypt } from "@emailautomation/security";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create test team
  const team = await prisma.team.upsert({
    where: { id: "test-team-1" },
    update: {},
    create: {
      id: "test-team-1",
      name: "Test Team",
      settings: {},
    },
  });
  console.log("Created team:", team.name);

  // Create test user with known password
  const passwordHash = await hashPassword("password123");
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: { passwordHash },
    create: {
      id: "test-user-1",
      email: "test@example.com",
      name: "Test User",
      passwordHash,
      role: "admin",
      teamId: team.id,
    },
  });
  console.log("Created user:", user.email);

  // Create mailbox connected to GreenMail test server
  const encryptionKey = process.env.ENCRYPTION_KEY || "dev-encryption-key-32-chars-min!";
  const imapPasswordEnc = encrypt("test", encryptionKey);
  const smtpPasswordEnc = encrypt("test", encryptionKey);

  const mailbox = await prisma.mailbox.upsert({
    where: {
      emailAddress_teamId: {
        emailAddress: "test@localhost",
        teamId: team.id,
      },
    },
    update: {},
    create: {
      id: "test-mailbox-1",
      emailAddress: "test@localhost",
      displayName: "Test Inbox",
      type: "personal",
      teamId: team.id,
      imapHost: "localhost",
      imapPort: 3143,
      imapUser: "test",
      imapPasswordEnc,
      smtpHost: "localhost",
      smtpPort: 3025,
      smtpUser: "test",
      smtpPasswordEnc,
    },
  });
  console.log("Created mailbox:", mailbox.emailAddress);

  // Give user access to mailbox
  await prisma.mailboxAccess.upsert({
    where: {
      userId_mailboxId: {
        userId: user.id,
        mailboxId: mailbox.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      mailboxId: mailbox.id,
      permission: "admin",
    },
  });
  console.log("Granted mailbox access to user");

  // Create some sample tags
  const tags = [
    { name: "Urgent", color: "#ef4444", aiAction: "notify" },
    { name: "Support", color: "#3b82f6", aiAction: "draft" },
    { name: "Sales", color: "#22c55e", aiAction: "none" },
    { name: "Newsletter", color: "#8b5cf6", aiAction: "archive" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: {
        teamId_name: {
          teamId: team.id,
          name: tag.name,
        },
      },
      update: {},
      create: {
        teamId: team.id,
        name: tag.name,
        color: tag.color,
        aiAction: tag.aiAction,
      },
    });
  }
  console.log("Created sample tags");

  // Create a sample thread with emails for testing
  const thread = await prisma.thread.upsert({
    where: { id: "test-thread-1" },
    update: {},
    create: {
      id: "test-thread-1",
      mailboxId: mailbox.id,
      teamId: team.id,
      subject: "Welcome to the Email Client",
      status: "open",
      lastActivityAt: new Date(),
    },
  });

  await prisma.email.upsert({
    where: { messageId: "welcome-email-1" },
    update: {},
    create: {
      threadId: thread.id,
      messageId: "welcome-email-1",
      subject: "Welcome to the Email Client",
      bodyText:
        "Hello!\n\nWelcome to your new collaborative email client. This is a sample email to help you get started.\n\nBest regards,\nThe Team",
      bodyHtml:
        "<p>Hello!</p><p>Welcome to your new collaborative email client. This is a sample email to help you get started.</p><p>Best regards,<br>The Team</p>",
      fromAddress: "welcome@example.com",
      fromName: "Welcome Bot",
      toAddresses: ["test@localhost"],
      date: new Date(),
      folder: "INBOX",
      isBot: true,
    },
  });
  console.log("Created sample thread with email");

  console.log("\nSeed completed!");
  console.log("\nTest credentials:");
  console.log("  Email: test@example.com");
  console.log("  Password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
