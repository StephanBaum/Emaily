"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare, MoreVertical, Pencil, Trash2, Send } from "lucide-react";
import { getInitials } from "@/lib/format";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface CommentSectionProps {
  threadId: string;
  initialComments: Comment[];
  compact?: boolean;
  onCountChange?: (count: number) => void;
}

export function CommentSection({ threadId, initialComments, compact = false, onCountChange }: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");

  // Sync server-rendered props to local state when they change (e.g. after router.refresh())
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // Notify parent of count changes
  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        setNewComment("");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEdit(commentId: string) {
    if (!editContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });

      if (res.ok) {
        const updated = await res.json();
        setComments(comments.map((c) => (c.id === commentId ? updated : c)));
        setEditingId(null);
        setEditContent("");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditContent("");
  }

  // Compact mode for panel - no outer container or header
  if (compact) {
    return (
      <div className="space-y-3">
        {/* Comment List */}
        {comments.length > 0 && (
          <div className="space-y-2">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="group flex gap-2 rounded-md bg-background p-2"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(comment.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-xs font-medium truncate">
                        {comment.user.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {session?.user?.id === comment.user.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEditing(comment)}>
                            <Pencil className="mr-2 h-3 w-3" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(comment.id)}
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {editingId === comment.id ? (
                    <div className="mt-1 space-y-1">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[40px] text-xs"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleEdit(comment.id)}
                          disabled={isSubmitting || !editContent.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs whitespace-pre-wrap mt-0.5">
                      {comment.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Comment Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">
              {session?.user?.name ? getInitials(session.user.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex gap-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[32px] flex-1 resize-none text-xs py-1.5"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8"
              disabled={isSubmitting || !newComment.trim()}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="border-t bg-muted/30">
      <div className="px-6 py-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>Team Comments ({comments.length})</span>
        </div>

        {/* Comment List */}
        {comments.length > 0 && (
          <div className="mb-4 space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="group flex gap-3 rounded-lg bg-background p-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {comment.user.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {comment.createdAt !== comment.updatedAt && (
                        <span className="text-xs text-muted-foreground">
                          (edited)
                        </span>
                      )}
                    </div>
                    {session?.user?.id === comment.user.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEditing(comment)}>
                            <Pencil className="mr-2 h-3 w-3" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(comment.id)}
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {editingId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[60px] text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleEdit(comment.id)}
                          disabled={isSubmitting || !editContent.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Comment Form */}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {session?.user?.name ? getInitials(session.user.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment for your team..."
              className="min-h-[40px] flex-1 resize-none text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isSubmitting || !newComment.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Press Ctrl+Enter to send
        </p>
      </div>
    </div>
  );
}
