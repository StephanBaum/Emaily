import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@emailautomation/database";

interface SearchResult {
  thread_id: string;
  subject: string;
  status: string;
  has_sent_reply: boolean;
  last_activity_at: Date;
  mailbox_id: string;
  relevance: number;
  email_from_name: string | null;
  email_from_address: string;
  headline: string;
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const tagId = searchParams.get("tagId");
  const mailboxId = searchParams.get("mailboxId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  // Get mailbox IDs the user has access to
  const accessibleMailboxes = await prisma.mailboxAccess.findMany({
    where: { userId: session.user.id },
    select: { mailboxId: true },
  });
  const accessibleMailboxIds = accessibleMailboxes.map((a) => a.mailboxId);

  if (accessibleMailboxIds.length === 0) {
    return NextResponse.json({ threads: [], total: 0, highlights: {} });
  }

  // Scope to specific mailbox if requested (must be accessible)
  const mailboxIds = mailboxId
    ? accessibleMailboxIds.filter((id) => id === mailboxId)
    : accessibleMailboxIds;

  if (mailboxIds.length === 0) {
    return NextResponse.json({ threads: [], total: 0, highlights: {} });
  }

  // Build dynamic WHERE clauses
  const conditions: Prisma.Sql[] = [
    Prisma.sql`e.search_vector @@ plainto_tsquery('english', ${query})`,
    Prisma.sql`t.mailbox_id = ANY(${mailboxIds})`,
  ];

  if (status && status !== "all") {
    conditions.push(Prisma.sql`t.status = ${status}`);
  }

  if (tagId) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM thread_tags tt WHERE tt.thread_id = t.id AND tt.tag_id = ${tagId})`
    );
  }

  const whereClause = Prisma.join(conditions, " AND ");

  // Count total matches
  const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT t.id) as count
    FROM threads t
    JOIN emails e ON e.thread_id = t.id
    WHERE ${whereClause}
  `;
  const total = Number(countResult[0].count);

  if (total === 0) {
    return NextResponse.json({ threads: [], total: 0, highlights: {} });
  }

  // Fetch matching threads with relevance ranking and headline snippets
  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT DISTINCT ON (t.id)
      t.id as thread_id,
      t.subject,
      t.status,
      t.has_sent_reply,
      t.last_activity_at,
      t.mailbox_id,
      ts_rank(e.search_vector, plainto_tsquery('english', ${query})) AS relevance,
      e.from_name AS email_from_name,
      e.from_address AS email_from_address,
      ts_headline('english', e.body_text, plainto_tsquery('english', ${query}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS headline
    FROM threads t
    JOIN emails e ON e.thread_id = t.id
    WHERE ${whereClause}
    ORDER BY t.id, relevance DESC
  `;

  // Re-sort by relevance then activity
  results.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });

  const paged = results.slice(offset, offset + limit);

  // Build highlights map and thread list
  const highlights: Record<string, string> = {};
  const threadIds = paged.map((r) => {
    highlights[r.thread_id] = r.headline;
    return r.thread_id;
  });

  // Fetch full thread data with includes (matching the threads API shape)
  const threads = threadIds.length > 0
    ? await prisma.thread.findMany({
        where: { id: { in: threadIds } },
        include: {
          emails: {
            orderBy: { date: "desc" },
            take: 1,
            select: {
              id: true,
              fromAddress: true,
              fromName: true,
              bodyText: true,
              date: true,
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
          assignments: {
            where: { status: { not: "done" } },
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
          seenBy: {
            where: { userId: session.user.id },
            select: { userId: true },
          },
          _count: {
            select: { emails: true },
          },
        },
      })
    : [];

  // Preserve relevance order
  const threadMap = new Map(threads.map((t) => [t.id, t]));
  const orderedThreads = threadIds
    .map((id) => threadMap.get(id))
    .filter(Boolean);

  return NextResponse.json({
    threads: orderedThreads,
    total,
    highlights,
  });
}
