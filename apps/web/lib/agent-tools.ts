import { prisma } from "@/lib/prisma";
import type { AgentToolResult } from "@emailautomation/ai-engine";

const MAX_RESULT_CHARS = 3000;

function truncateData(data: string): { data: string; truncated: boolean } {
  if (data.length <= MAX_RESULT_CHARS) return { data, truncated: false };
  return { data: data.slice(0, MAX_RESULT_CHARS) + "...", truncated: true };
}

export async function executeSearchThreads(
  params: Record<string, unknown>,
  teamId: string
): Promise<AgentToolResult> {
  const query = String(params.query || "");
  const senderEmail = params.senderEmail ? String(params.senderEmail) : undefined;
  const limit = Math.min(Number(params.limit) || 5, 10);

  const threads = await prisma.thread.findMany({
    where: {
      mailbox: { teamId },
      status: { not: "quarantined" },
      ...(senderEmail
        ? { emails: { some: { fromAddress: { contains: senderEmail, mode: "insensitive" } } } }
        : {}),
      OR: [
        { subject: { contains: query, mode: "insensitive" } },
        { emails: { some: { bodyText: { contains: query, mode: "insensitive" } } } },
      ],
    },
    select: {
      id: true,
      subject: true,
      status: true,
      lastActivityAt: true,
      tags: { include: { tag: { select: { name: true } } } },
      emails: {
        take: 1,
        orderBy: { date: "desc" },
        select: { fromAddress: true, date: true },
      },
    },
    orderBy: { lastActivityAt: "desc" },
    take: limit,
  });

  const data = threads.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    lastActivity: t.lastActivityAt.toISOString(),
    tags: t.tags.map((tt) => tt.tag.name),
    latestSender: t.emails[0]?.fromAddress || null,
  }));

  return { tool: "search_threads", data };
}

export async function executeGetSenderProfile(
  params: Record<string, unknown>,
  teamId: string
): Promise<AgentToolResult> {
  const email = String(params.email || "").toLowerCase();

  const contact = await prisma.contact.findUnique({
    where: { teamId_email: { teamId, email } },
  });

  const recentThreads = await prisma.thread.findMany({
    where: {
      mailbox: { teamId },
      emails: { some: { fromAddress: { equals: email, mode: "insensitive" } } },
    },
    select: {
      id: true,
      subject: true,
      status: true,
      lastActivityAt: true,
      tags: { include: { tag: { select: { name: true } } } },
    },
    orderBy: { lastActivityAt: "desc" },
    take: 5,
  });

  const data = {
    contact: contact
      ? {
          name: contact.name,
          company: contact.company,
          domain: contact.domain,
          trustLevel: contact.trustLevel,
          interactionCount: contact.interactionCount,
          repliedToCount: contact.repliedToCount,
          notes: contact.notes,
          lastContactedAt: contact.lastContactedAt?.toISOString() || null,
        }
      : null,
    recentThreads: recentThreads.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      tags: t.tags.map((tt) => tt.tag.name),
    })),
  };

  return { tool: "get_sender_profile", data };
}

export async function executeGetThreadDetail(
  params: Record<string, unknown>,
  teamId: string
): Promise<AgentToolResult> {
  const threadId = String(params.threadId || "");

  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      mailbox: { teamId },
    },
    select: {
      subject: true,
      status: true,
      emails: {
        orderBy: { date: "asc" },
        select: {
          fromAddress: true,
          bodyText: true,
          date: true,
          isSent: true,
        },
      },
      tags: { include: { tag: { select: { name: true } } } },
      comments: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      },
    },
  });

  if (!thread) {
    return { tool: "get_thread_detail", data: { error: "Thread not found or access denied" } };
  }

  const serialized = JSON.stringify({
    subject: thread.subject,
    status: thread.status,
    tags: thread.tags.map((tt) => tt.tag.name),
    emails: thread.emails.map((e) => ({
      from: e.fromAddress,
      body: e.bodyText,
      date: e.date.toISOString(),
      isSent: e.isSent,
    })),
    comments: thread.comments.map((c) => ({
      author: c.user.name,
      text: c.content,
    })),
  });

  const result = truncateData(serialized);
  return { tool: "get_thread_detail", data: JSON.parse(result.data.endsWith("...") ? serialized : result.data), truncated: result.truncated };
}

export async function executeSearchKnowledge(
  params: Record<string, unknown>,
  teamId: string
): Promise<AgentToolResult> {
  const query = String(params.query || "").toLowerCase();

  const qaPairs = await prisma.qAPair.findMany({
    where: {
      teamId,
      approved: true,
      OR: [
        { triggerPatterns: { hasSome: [query] } },
        { idealResponse: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 5,
  });

  const data = qaPairs.map((qa) => ({
    triggers: qa.triggerPatterns,
    response: qa.idealResponse,
    usageCount: qa.usageCount,
    successRate: qa.successRate,
  }));

  return { tool: "search_knowledge", data };
}

export async function executeCheckPastDecisions(
  params: Record<string, unknown>,
  teamId: string
): Promise<AgentToolResult> {
  const senderEmail = params.senderEmail ? String(params.senderEmail) : undefined;
  const tagName = params.tagName ? String(params.tagName) : undefined;

  const activities = await prisma.activityLog.findMany({
    where: {
      teamId,
      action: { in: ["ai_tagged", "ai_draft_generated", "ai_archived", "ai_quarantined", "ai_auto_replied"] },
      ...(senderEmail
        ? {
            targetType: "thread",
            targetId: {
              in: await prisma.thread
                .findMany({
                  where: {
                    mailbox: { teamId },
                    emails: { some: { fromAddress: { equals: senderEmail, mode: "insensitive" } } },
                  },
                  select: { id: true },
                  take: 20,
                })
                .then((threads) => threads.map((t) => t.id)),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      action: true,
      metadata: true,
      createdAt: true,
      targetId: true,
    },
  });

  let filtered = activities;
  if (tagName) {
    filtered = activities.filter((a) => {
      const meta = a.metadata as Record<string, unknown> | null;
      const tags = meta?.tags as { name: string }[] | undefined;
      return (
        meta?.tagName === tagName ||
        tags?.some((t) => t.name.toLowerCase() === tagName.toLowerCase())
      );
    });
  }

  const data = filtered.map((a) => ({
    action: a.action,
    metadata: a.metadata,
    date: a.createdAt.toISOString(),
    threadId: a.targetId,
  }));

  return { tool: "check_past_decisions", data };
}

const TOOL_EXECUTORS: Record<
  string,
  (params: Record<string, unknown>, teamId: string) => Promise<AgentToolResult>
> = {
  search_threads: executeSearchThreads,
  get_sender_profile: executeGetSenderProfile,
  get_thread_detail: executeGetThreadDetail,
  search_knowledge: executeSearchKnowledge,
  check_past_decisions: executeCheckPastDecisions,
};

export async function executeAgentTool(
  toolName: string,
  params: Record<string, unknown>,
  teamId: string
): Promise<AgentToolResult> {
  const executor = TOOL_EXECUTORS[toolName];
  if (!executor) {
    return { tool: toolName, data: { error: `Unknown tool: ${toolName}` } };
  }
  return executor(params, teamId);
}
