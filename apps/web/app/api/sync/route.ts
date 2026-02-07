import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MailboxSyncer, type SyncCallbacks, type EmailToStore, type ThreadToCreate } from "@emailautomation/mail-engine";
import { decrypt } from "@emailautomation/security";

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
      const imapPassword = decrypt(mailbox.imapPasswordEnc, encryptionKey);

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
          await prisma.email.create({
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
              rawHeaders: email.headers,
            },
          });
          await prisma.thread.update({
            where: { id: threadId },
            data: { lastActivityAt: new Date() },
          });
        },

        createThread: async (_mailboxId: string, _teamId: string, thread: ThreadToCreate) => {
          const newThread = await prisma.thread.create({
            data: {
              mailboxId: mailbox.id,
              teamId: mailbox.teamId,
              subject: thread.subject,
              status: "open",
              lastActivityAt: new Date(),
              emails: {
                create: thread.emails.map((email) => ({
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
                  rawHeaders: email.headers,
                })),
              },
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

      const syncer = new MailboxSyncer(
        {
          host: mailbox.imapHost,
          port: mailbox.imapPort || 993,
          secure: true,
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
    results,
  });
}
