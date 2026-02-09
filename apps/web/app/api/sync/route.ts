import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MailboxSyncer, type SyncCallbacks, type EmailToStore, type ThreadToCreate, analyzeSpam, SPAM_THRESHOLD_QUARANTINE } from "@emailautomation/mail-engine";
import { decrypt, encrypt } from "@emailautomation/security";
import { injectTestEmails } from "@/lib/test-email-injector";
import { upsertContactFromEmail } from "@/lib/contacts";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all mailboxes the user has access to
  const accessibleMailboxes = await prisma.mailboxAccess.findMany({
    where: { userId: session.user.id },
    include: {
      mailbox: true,
    },
  });

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Inject random test emails via SMTP before syncing (dev mode)
  const injected: { mailbox: string; sent: number; subjects: string[] }[] = [];
  if (process.env.NODE_ENV !== "production") {
    for (const { mailbox } of accessibleMailboxes) {
      if (mailbox.smtpHost && mailbox.smtpPort) {
        try {
          const result = await injectTestEmails(
            mailbox.smtpHost,
            mailbox.smtpPort,
            mailbox.emailAddress
          );
          injected.push({
            mailbox: mailbox.emailAddress,
            ...result,
          });
        } catch (err) {
          console.error(`[TestInjector] Failed for ${mailbox.emailAddress}:`, err);
        }
      }
    }
  }

  const results: { mailbox: string; newEmails: number; newThreads: number; errors: string[] }[] = [];

  for (const { mailbox } of accessibleMailboxes) {
    if (!mailbox.imapHost || !mailbox.imapPasswordEnc) {
      results.push({
        mailbox: mailbox.emailAddress,
        newEmails: 0,
        newThreads: 0,
        errors: ["Not configured for IMAP"],
      });
      continue;
    }

    try {
      let imapPassword: string;
      try {
        imapPassword = decrypt(mailbox.imapPasswordEnc, encryptionKey);
      } catch {
        if (process.env.NODE_ENV !== "production") {
          // Dev mode: encryption key mismatch from seed — re-encrypt with current key
          imapPassword = mailbox.imapUser || "test";
          const fixed = encrypt(imapPassword, encryptionKey);
          await prisma.mailbox.update({
            where: { id: mailbox.id },
            data: { imapPasswordEnc: fixed, smtpPasswordEnc: fixed },
          });
          console.warn(`[Sync] Re-encrypted credentials for ${mailbox.emailAddress} (key mismatch)`);
        } else {
          throw new Error("Failed to decrypt IMAP credentials");
        }
      }

      const callbacks: SyncCallbacks = {
        getExistingThreads: async () => {
          const threads = await prisma.thread.findMany({
            where: { mailboxId: mailbox.id },
            include: {
              emails: {
                select: {
                  messageId: true,
                },
              },
            },
          });
          return threads.map((t) => ({
            id: t.id,
            subject: t.subject,
            messageIds: t.emails.map((e) => e.messageId),
          }));
        },

        addEmailToThread: async (threadId: string, email: EmailToStore) => {
          // Spam analysis
          const spamAnalysis = analyzeSpam({
            headers: email.headers,
            fromAddress: email.fromAddress,
            subject: email.subject,
          });

          const created = await prisma.email.create({
            data: {
              threadId,
              messageId: email.messageId,
              inReplyTo: email.inReplyTo,
              references: email.references,
              imapUid: email.uid,
              subject: email.subject,
              bodyText: email.bodyText,
              bodyHtml: email.bodyHtml,
              fromAddress: email.fromAddress,
              fromName: email.fromName,
              toAddresses: email.toAddresses,
              ccAddresses: email.ccAddresses,
              date: email.date,
              folder: email.folder,
              isBot: email.isBot,
              spamScore: spamAnalysis.headerScore,
              spamAnalysis: JSON.parse(JSON.stringify(spamAnalysis)),
              rawHeaders: email.headers,
            },
          });
          await prisma.thread.update({
            where: { id: threadId },
            data: { lastActivityAt: new Date() },
          });

          // Auto-learn contact
          await upsertContactFromEmail(
            mailbox.teamId,
            email.fromAddress,
            email.fromName
          );
        },

        createThread: async (_mailboxId: string, _teamId: string, thread: ThreadToCreate) => {
          // Analyze first email for spam + contact
          const firstEmail = thread.emails[0];
          const spamAnalysis = analyzeSpam({
            headers: firstEmail.headers,
            fromAddress: firstEmail.fromAddress,
            subject: firstEmail.subject,
          });

          const { trustLevel } = await upsertContactFromEmail(
            mailbox.teamId,
            firstEmail.fromAddress,
            firstEmail.fromName
          );

          const shouldQuarantine = spamAnalysis.headerScore >= SPAM_THRESHOLD_QUARANTINE;

          const newThread = await prisma.thread.create({
            data: {
              mailboxId: mailbox.id,
              teamId: mailbox.teamId,
              subject: thread.subject,
              status: shouldQuarantine ? "quarantined" : "open",
              senderTrustLevel: trustLevel,
              lastActivityAt: new Date(),
              emails: {
                create: thread.emails.map((email) => {
                  const emailSpam = email === firstEmail
                    ? spamAnalysis
                    : analyzeSpam({
                        headers: email.headers,
                        fromAddress: email.fromAddress,
                        subject: email.subject,
                      });
                  return {
                    messageId: email.messageId,
                    inReplyTo: email.inReplyTo,
                    references: email.references,
                    imapUid: email.uid,
                    subject: email.subject,
                    bodyText: email.bodyText,
                    bodyHtml: email.bodyHtml,
                    fromAddress: email.fromAddress,
                    fromName: email.fromName,
                    toAddresses: email.toAddresses,
                    ccAddresses: email.ccAddresses,
                    date: email.date,
                    folder: email.folder,
                    isBot: email.isBot,
                    spamScore: emailSpam.headerScore,
                    spamAnalysis: JSON.parse(JSON.stringify(emailSpam)),
                    rawHeaders: email.headers,
                  };
                }),
              },
            },
            include: {
              emails: { select: { id: true } },
            },
          });
          return newThread.id;
        },

        updateSyncState: async (_mailboxId: string, state) => {
          await prisma.mailboxSync.upsert({
            where: {
              mailboxId_folderName: {
                mailboxId: mailbox.id,
                folderName: state.folderName,
              },
            },
            update: {
              lastUid: state.lastUid,
              lastSyncAt: state.lastSyncAt,
              syncStatus: "idle",
              errorMessage: null,
            },
            create: {
              mailboxId: mailbox.id,
              folderName: state.folderName,
              lastUid: state.lastUid,
              lastSyncAt: state.lastSyncAt,
              syncStatus: "idle",
            },
          });
        },

        getSyncState: async (_mailboxId: string, folder: string) => {
          const state = await prisma.mailboxSync.findUnique({
            where: {
              mailboxId_folderName: {
                mailboxId: mailbox.id,
                folderName: folder,
              },
            },
          });
          return state
            ? {
                folderName: state.folderName,
                lastUid: state.lastUid,
                lastSyncAt: state.lastSyncAt,
              }
            : null;
        },
      };

      const imapPort = mailbox.imapPort || 993;
      const syncer = new MailboxSyncer(
        {
          host: mailbox.imapHost,
          port: imapPort,
          secure: imapPort === 993 || imapPort === 3993,
          auth: {
            user: mailbox.imapUser || mailbox.emailAddress,
            pass: imapPassword,
          },
        },
        mailbox.id,
        mailbox.teamId,
        callbacks
      );

      const result = await syncer.syncFolder("INBOX");

      results.push({
        mailbox: mailbox.emailAddress,
        newEmails: result.newEmails,
        newThreads: result.newThreads,
        errors: result.errors,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Sync error for ${mailbox.emailAddress}:`, error);

      // Update sync state with error
      await prisma.mailboxSync.upsert({
        where: {
          mailboxId_folderName: {
            mailboxId: mailbox.id,
            folderName: "INBOX",
          },
        },
        update: {
          syncStatus: "error",
          errorMessage,
        },
        create: {
          mailboxId: mailbox.id,
          folderName: "INBOX",
          syncStatus: "error",
          errorMessage,
        },
      });

      results.push({
        mailbox: mailbox.emailAddress,
        newEmails: 0,
        newThreads: 0,
        errors: [errorMessage],
      });
    }
  }

  return NextResponse.json({
    success: true,
    injected: injected.length > 0 ? injected : undefined,
    results,
  });
}
