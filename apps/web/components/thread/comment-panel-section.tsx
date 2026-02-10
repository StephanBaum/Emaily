"use client";

import { useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { PanelSection } from "./collaboration-panel";
import { CommentSection } from "./comment-section";

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

interface CommentPanelSectionProps {
  threadId: string;
  initialComments: Comment[];
}

export function CommentPanelSection({ threadId, initialComments }: CommentPanelSectionProps) {
  const [count, setCount] = useState(initialComments.length);
  const handleCountChange = useCallback((newCount: number) => setCount(newCount), []);

  return (
    <PanelSection
      title={`Comments (${count})`}
      icon={<MessageSquare className="h-4 w-4" />}
    >
      <CommentSection
        threadId={threadId}
        initialComments={initialComments}
        onCountChange={handleCountChange}
        compact
      />
    </PanelSection>
  );
}
