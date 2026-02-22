import { Suspense } from "react";
import { ThreadList } from "@/components/inbox/thread-list";
import { SearchBar } from "@/components/inbox/search-bar";
import { FilterToolbar } from "@/components/inbox/filter-toolbar";
import { AISummaryPanel, InboxDashboard } from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

interface InboxPageProps {
  searchParams: Promise<{
    mailbox?: string;
    status?: string;
    filter?: string;
    tag?: string;
    tags?: string;
    group?: string;
    q?: string;
  }>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;

  const isTagView = Boolean(params.tag || params.tags);
  const isSentView = params.filter === "sent";

  const title = params.group
    ? params.group
    : params.tag
    ? "Tagged Threads"
    : isSentView
    ? "Sent"
    : params.status === "archived"
    ? "Archived"
    : params.status === "snoozed"
    ? "Snoozed"
    : "Inbox";

  // Determine the status to pass to ThreadList:
  // - Tag view with no explicit status -> show all statuses
  // - Sent view -> show all statuses (sent threads can be open or archived)
  // - Explicit status param -> use that
  // - Default inbox -> "open"
  const effectiveStatus = params.status || (isTagView || isSentView ? "all" : "open");

  // Default inbox = no tags, no explicit status, no filter, no search
  const isDefaultInbox = !isTagView && !params.status && !params.filter && !params.q;

  // For default inbox, show the humanized dashboard
  // For filtered views (tags, archived, search), show compact panel + thread list
  if (isDefaultInbox) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6 gap-4">
          <h1 className="text-lg font-semibold shrink-0">{title}</h1>
          <div className="flex-1" />
          <SearchBar />
        </header>
        <div className="flex-1 overflow-auto">
          <InboxDashboard mailboxId={params.mailbox} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6 gap-4">
        <h1 className="text-lg font-semibold shrink-0">{title}</h1>
        <FilterToolbar
          status={params.status}
          tagId={params.tag}
          tagIds={params.tags}
          mailboxId={params.mailbox}
          group={params.group}
        />
        <SearchBar />
      </header>
      <div className="flex-1 overflow-auto">
        {/* Show AI summary panel in filtered views */}
        <AISummaryPanel />
        <Suspense fallback={<ThreadListSkeleton />}>
          <ThreadList
            mailboxId={params.mailbox}
            status={effectiveStatus}
            tagId={params.tag}
            tagIds={params.tags}
            query={params.q}
            filter={isSentView ? "sent" : undefined}
          />
        </Suspense>
      </div>
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
