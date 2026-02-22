import type { Queue } from "bullmq";
import { prisma } from "@emaily/database";
import type { SyncMailboxJob } from "./queues";

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Query all configured mailboxes and upsert repeatable BullMQ jobs.
 * Stale jobs for deleted mailboxes are cleaned up.
 */
export async function scheduleAllMailboxes(queue: Queue<SyncMailboxJob>) {
  // Find all mailboxes with IMAP configured
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      imapHost: { not: null },
      imapPasswordEnc: { not: null },
    },
    select: {
      id: true,
      teamId: true,
      emailAddress: true,
    },
  });

  const activeMailboxIds = new Set(mailboxes.map((m) => m.id));

  // Remove stale repeatable jobs for deleted mailboxes
  const schedulers = await queue.getJobSchedulers();
  for (const scheduler of schedulers) {
    // Job scheduler IDs are formatted as "sync-<mailboxId>"
    const mailboxId = scheduler.id.replace("sync-", "");
    if (!activeMailboxIds.has(mailboxId)) {
      console.log(`[Sync Scheduler] Removing stale job for mailbox ${mailboxId}`);
      await queue.removeJobScheduler(scheduler.id);
    }
  }

  // Upsert repeatable jobs — one per mailbox, staggered offsets
  for (let i = 0; i < mailboxes.length; i++) {
    const mailbox = mailboxes[i];
    // Stagger by spreading jobs evenly across the interval
    const offsetMs = mailboxes.length > 1
      ? Math.floor((SYNC_INTERVAL_MS / mailboxes.length) * i)
      : 0;

    await queue.upsertJobScheduler(
      `sync-${mailbox.id}`,
      {
        every: SYNC_INTERVAL_MS,
        offset: offsetMs,
      },
      {
        name: `sync-${mailbox.emailAddress}`,
        data: {
          mailboxId: mailbox.id,
          teamId: mailbox.teamId,
          emailAddress: mailbox.emailAddress,
        },
      }
    );
  }

  console.log(`[Sync Scheduler] Scheduled ${mailboxes.length} mailbox(es) for sync`);
}
