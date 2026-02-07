"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function ThreadHeader({ thread }: ThreadHeaderProps) {
  const router = useRouter();

  async function updateStatus(status: string) {
    await fetch(`/api/threads/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/inbox")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{thread.subject}</h1>
          <div className="mt-1 flex items-center gap-2">
            {thread.tags.map(({ tag }) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
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
      </div>
    </header>
  );
}
