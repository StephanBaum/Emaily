"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Archive,
  Clock,
  MoreVertical,
  Tag,
  Trash2,
  Inbox,
} from "lucide-react";
import { TagPicker, TagMenuPopover } from "./tag-picker";
import { useThreadActions } from "@/hooks/use-thread-actions";

interface ThreadTag {
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

interface Thread {
  id: string;
  subject: string;
  status: string;
  tags: ThreadTag[];
}

interface ThreadHeaderProps {
  thread: Thread;
}

function truncateSubject(subject: string, maxLength = 256): string {
  if (subject.length <= maxLength) return subject;
  return subject.slice(0, maxLength) + "\u2026";
}

export function ThreadHeader({ thread }: ThreadHeaderProps) {
  const router = useRouter();
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const { updateStatus } = useThreadActions(thread.id);

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push("/inbox")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <h1 className="text-lg font-semibold shrink-0 max-w-prose">
            {truncateSubject(thread.subject)}
          </h1>
          <TagPicker threadId={thread.id} currentTags={thread.tags} />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {thread.status === "open" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStatus("archived")}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStatus("snoozed")}
            >
              <Clock className="mr-2 h-4 w-4" />
              Snooze
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateStatus("open")}
          >
            <Inbox className="mr-2 h-4 w-4" />
            Move to Inbox
          </Button>
        )}

        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setTimeout(() => setTagMenuOpen(true), 150);
                }}
              >
                <Tag className="mr-2 h-4 w-4" />
                Add Tag
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <TagMenuPopover
            threadId={thread.id}
            currentTags={thread.tags}
            open={tagMenuOpen}
            onOpenChange={setTagMenuOpen}
          />
        </div>
      </div>
    </header>
  );
}
