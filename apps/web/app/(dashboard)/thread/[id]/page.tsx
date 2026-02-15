import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueImapOperation } from "@emaily/mail-engine";
import { getCachedThreadEmails } from "@/lib/thread-cache";
import { EmailChain } from "@/components/thread/email-chain";
import { ThreadHeader } from "@/components/thread/thread-header";
import { SharedDraftComposer } from "@/components/thread/shared-draft-composer";
import { CollaborationPanel, PanelSection } from "@/components/thread/collaboration-panel";
import { CommentPanelSection } from "@/components/thread/comment-panel-section";
import { SeenByIndicator } from "@/components/thread/seen-by-indicator";
import { AssignmentSection } from "@/components/thread/assignment-section";
import { Skeleton } from "@/components/ui/skeleton";
import { AIActivityPanel } from "@/components/thread/ai-activity-panel";
import { SenderInfoPanel } from "@/components/thread/sender-info-panel";
import { Users, Eye, Sparkles, ShieldCheck } from "lucide-react";

interface ThreadPageProps {
  params: Promise<{ id: string }>;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    notFound();
  }

  // Fetch thread metadata (without emails) and cached emails in parallel
  const [threadMeta, cachedEmails] = await Promise.all([
    prisma.thread.findFirst({
      where: {
        id,
        mailbox: {
          access: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
      include: {
        mailbox: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            teamId: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        assignments: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        seenBy: {
          orderBy: { seenAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        sharedDrafts: {
          where: {
            status: { not: "sent" },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            agent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    getCachedThreadEmails(id),
  ]);

  if (!threadMeta) {
    notFound();
  }

  // Merge emails into thread object, converting serialized dates back to Date objects
  const thread = {
    ...threadMeta,
    emails: cachedEmails.map((e) => ({
      ...e,
      date: new Date(e.date),
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    })),
  };

  // Fetch team members for assignment picker
  const teamMembers = await prisma.user.findMany({
    where: {
      teamId: thread.mailbox.teamId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Look up sender contact for trust panel
  const latestReceivedEmail = [...thread.emails].reverse().find((e) => !e.isSent);
  const senderContact = latestReceivedEmail
    ? await prisma.contact.findUnique({
        where: {
          teamId_email: {
            teamId: thread.mailbox.teamId,
            email: latestReceivedEmail.fromAddress.toLowerCase(),
          },
        },
        select: { id: true, trustLevel: true },
      })
    : null;

  // Fetch thread_reopened events for archive divider
  const reopenEvents = await prisma.activityLog.findMany({
    where: {
      targetType: "thread",
      targetId: thread.id,
      action: "thread_reopened",
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const reopenedTimestamps = reopenEvents.map((e) => e.createdAt);

  // Mark as seen and refetch updated seenBy list
  await prisma.seenBy.upsert({
    where: {
      threadId_userId: {
        threadId: thread.id,
        userId: session.user.id,
      },
    },
    update: {
      seenAt: new Date(),
      lastSeenEmailId: thread.emails[thread.emails.length - 1]?.id,
    },
    create: {
      threadId: thread.id,
      userId: session.user.id,
      lastSeenEmailId: thread.emails[thread.emails.length - 1]?.id,
    },
  });

  // Queue IMAP mark-as-read for all emails in thread (non-blocking)
  const emailsWithUid = thread.emails.filter((e) => e.imapUid !== null);
  for (const email of emailsWithUid) {
    const operation = await prisma.imapOperation.create({
      data: {
        mailboxId: thread.mailbox.id,
        threadId: thread.id,
        emailId: email.id,
        operation: "mark_read",
        folder: email.folder,
        imapUid: email.imapUid,
        payload: {},
        status: "pending",
      },
    });
    // Fire and forget - don't await
    queueImapOperation(
      operation.id,
      thread.mailbox.id,
      "mark_read",
      email.folder,
      email.imapUid ?? undefined
    ).catch((err) => console.error("Failed to queue mark_read:", err));
  }

  // Refetch seenBy to include current user's updated timestamp
  const seenBy = await prisma.seenBy.findMany({
    where: { threadId: thread.id },
    orderBy: { seenAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Serialize comments for client component
  const serializedComments = thread.comments.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }));

  // Serialize seenBy for client component
  const serializedSeenBy = seenBy.map((seen) => ({
    ...seen,
    seenAt: seen.seenAt.toISOString(),
  }));

  // Serialize assignments for client component
  const serializedAssignments = thread.assignments.map((assignment) => ({
    ...assignment,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    dueDate: assignment.dueDate?.toISOString() || null,
  }));

  // Get existing shared draft if any
  const existingDraft = thread.sharedDrafts[0];
  const serializedDraft = existingDraft
    ? {
        ...existingDraft,
        isLocked:
          !!existingDraft.lockedById &&
          !!existingDraft.lockExpiresAt &&
          new Date(existingDraft.lockExpiresAt) > new Date(),
        isLockedByMe:
          existingDraft.lockedById === session.user.id &&
          !!existingDraft.lockExpiresAt &&
          new Date(existingDraft.lockExpiresAt) > new Date(),
        lockedBy: null as { id: string; name: string; email: string } | null,
        lockExpiresAt: existingDraft.lockExpiresAt?.toISOString() || null,
      }
    : null;

  return (
    <div className="flex h-full flex-col">
      <ThreadHeader thread={thread} />
      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <Suspense fallback={<EmailChainSkeleton />}>
              <EmailChain emails={thread.emails} reopenedTimestamps={reopenedTimestamps} />
            </Suspense>
          </div>
          {thread.status === "quarantined" ? (
            <div className="border-t bg-destructive/5 px-6 py-3 text-sm text-destructive flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              This thread is quarantined as spam. Mark as not spam to reply.
            </div>
          ) : (
            <SharedDraftComposer
              thread={thread}
              mailbox={thread.mailbox}
              existingDraft={serializedDraft}
              confidence={existingDraft?.confidence as Record<string, number> | null ?? null}
              lockType={existingDraft?.lockType ?? null}
              agentName={existingDraft?.agent?.name ?? null}
            />
          )}
        </div>

        {/* Collaboration Panel */}
        <CollaborationPanel>
          {latestReceivedEmail && (
            <PanelSection
              title="Sender"
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              <SenderInfoPanel
                threadId={thread.id}
                senderEmail={latestReceivedEmail.fromAddress}
                senderName={latestReceivedEmail.fromName}
                senderTrustLevel={(senderContact?.trustLevel || thread.senderTrustLevel || "stranger") as "stranger" | "known" | "trusted" | "vip"}
                contactId={senderContact?.id || null}
                spamScore={latestReceivedEmail.spamScore ?? null}
                threadStatus={thread.status}
              />
            </PanelSection>
          )}

          <PanelSection
            title="AI Activity"
            icon={<Sparkles className="h-4 w-4" />}
          >
            <AIActivityPanel threadId={thread.id} />
          </PanelSection>

          <PanelSection
            title={`Assignments (${serializedAssignments.length})`}
            icon={<Users className="h-4 w-4" />}
          >
            <AssignmentSection
              threadId={thread.id}
              initialAssignments={serializedAssignments}
              teamMembers={teamMembers}
            />
          </PanelSection>

          <CommentPanelSection
            threadId={thread.id}
            initialComments={serializedComments}
          />

          <PanelSection
            title={`Viewed by (${serializedSeenBy.length})`}
            icon={<Eye className="h-4 w-4" />}
            defaultOpen={false}
          >
            <SeenByIndicator seenBy={serializedSeenBy} compact />
          </PanelSection>
        </CollaborationPanel>
      </div>
    </div>
  );
}

function EmailChainSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
