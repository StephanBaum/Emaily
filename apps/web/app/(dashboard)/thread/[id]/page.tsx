import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailChain } from "@/components/thread/email-chain";
import { ThreadHeader } from "@/components/thread/thread-header";
import { ReplyComposer } from "@/components/thread/reply-composer";
import { Skeleton } from "@/components/ui/skeleton";

interface ThreadPageProps {
  params: Promise<{ id: string }>;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    notFound();
  }

  const thread = await prisma.thread.findFirst({
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
        },
      },
      emails: {
        orderBy: { date: "asc" },
        include: {
          attachments: {
            select: {
              id: true,
              filename: true,
              contentType: true,
              size: true,
            },
          },
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      assignments: {
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!thread) {
    notFound();
  }

  // Mark as seen
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

  return (
    <div className="flex h-full flex-col">
      <ThreadHeader thread={thread} />
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<EmailChainSkeleton />}>
          <EmailChain emails={thread.emails} />
        </Suspense>
      </div>
      <ReplyComposer thread={thread} mailbox={thread.mailbox} />
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
