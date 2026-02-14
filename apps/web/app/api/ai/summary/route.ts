import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheOrFetch, cacheKeys, CACHE_TTL } from "@/lib/cache";
import type {
  AISummaryAction,
  AISummaryGroup,
  AISummaryItem,
  AISummaryResponse,
} from "@emailautomation/shared";

const AI_ACTIONS: AISummaryAction[] = [
  "ai_archived",
  "ai_tagged",
  "ai_draft_generated",
  "ai_auto_replied",
  "ai_quarantined",
];

const ACTION_LABELS: Record<AISummaryAction, string> = {
  ai_archived: "Archived",
  ai_tagged: "Tagged",
  ai_draft_generated: "Drafted",
  ai_auto_replied: "Auto-replied",
  ai_quarantined: "Quarantined",
};

async function fetchAISummary(
  teamId: string,
  userId: string,
  hours: number
): Promise<AISummaryResponse> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Get accessible mailbox IDs for this user
  const accessibleMailboxes = await prisma.mailboxAccess.findMany({
    where: { userId },
    select: { mailboxId: true },
  });
  const mailboxIds = accessibleMailboxes.map((a) => a.mailboxId);

  if (mailboxIds.length === 0) {
    return {
      groups: [],
      totalCount: 0,
      since,
    };
  }

  // Query ActivityLog for AI actions on threads in accessible mailboxes
  const activities = await prisma.activityLog.findMany({
    where: {
      teamId,
      action: { in: AI_ACTIONS },
      targetType: "thread",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get unique thread IDs
  const threadIds = [...new Set(activities.map((a) => a.targetId).filter(Boolean))] as string[];

  // Fetch threads with latest inbound email and tags
  const threads = await prisma.thread.findMany({
    where: {
      id: { in: threadIds },
      mailboxId: { in: mailboxIds },
    },
    select: {
      id: true,
      subject: true,
      emails: {
        where: { isSent: false },
        orderBy: { date: "desc" },
        take: 1,
        select: {
          fromName: true,
          fromAddress: true,
        },
      },
      tags: {
        select: {
          tag: {
            select: {
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  // Create thread lookup
  const threadMap = new Map(threads.map((t) => [t.id, t]));

  // Group activities by action
  const groupMap = new Map<AISummaryAction, AISummaryItem[]>();

  for (const action of AI_ACTIONS) {
    groupMap.set(action, []);
  }

  for (const activity of activities) {
    const action = activity.action as AISummaryAction;
    const thread = threadMap.get(activity.targetId || "");

    if (!thread) continue; // Thread not accessible or deleted

    const latestEmail = thread.emails[0];
    const item: AISummaryItem = {
      threadId: thread.id,
      subject: thread.subject,
      senderName: latestEmail?.fromName || null,
      senderEmail: latestEmail?.fromAddress || "",
      tags: thread.tags.map((t) => ({
        name: t.tag.name,
        color: t.tag.color,
      })),
      activityId: activity.id,
      createdAt: activity.createdAt,
    };

    groupMap.get(action)?.push(item);
  }

  // Build response groups (only include non-empty groups)
  const groups: AISummaryGroup[] = [];
  let totalCount = 0;

  for (const action of AI_ACTIONS) {
    const items = groupMap.get(action) || [];
    if (items.length > 0) {
      // Deduplicate by threadId (keep most recent)
      const seen = new Set<string>();
      const uniqueItems = items.filter((item) => {
        if (seen.has(item.threadId)) return false;
        seen.add(item.threadId);
        return true;
      });

      groups.push({
        action,
        label: ACTION_LABELS[action],
        count: uniqueItems.length,
        items: uniqueItems,
      });
      totalCount += uniqueItems.length;
    }
  }

  return {
    groups,
    totalCount,
    since,
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get("hours") || "24", 10);

  const teamId = session.user.teamId;
  const userId = session.user.id;

  // Cache per user+team+hours combo with short TTL
  const cacheKey = `${cacheKeys.aiSummary(teamId, hours)}:${userId}`;
  const result = await cacheOrFetch(cacheKey, CACHE_TTL.aiSummary, () =>
    fetchAISummary(teamId, userId, hours)
  );

  return NextResponse.json(result satisfies AISummaryResponse, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
    },
  });
}
