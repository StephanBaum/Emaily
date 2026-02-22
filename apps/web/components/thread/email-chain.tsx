"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArchiveRestore, Loader2 } from "lucide-react";
import { EmailMessage } from "./email-message";
import { VISIBLE_EMAILS_DEFAULT } from "@/lib/constants";

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

interface Email {
  id: string;
  messageId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  date: Date;
  isBot: boolean;
  isSent: boolean;
  attachments: Attachment[];
}

interface EmailChainProps {
  emails: Email[];
  reopenedTimestamps?: Date[];
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement ?? null;
  while (parent) {
    const style = getComputedStyle(parent);
    if (
      style.overflow === "auto" ||
      style.overflow === "scroll" ||
      style.overflowY === "auto" ||
      style.overflowY === "scroll"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export function EmailChain({ emails, reopenedTimestamps = [] }: EmailChainProps) {
  const [visibleCount, setVisibleCount] = useState(VISIBLE_EMAILS_DEFAULT);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const allVisible = visibleCount >= emails.length;
  const visibleEmails = allVisible ? emails : emails.slice(-visibleCount);

  // Map visible slice indices back to full-array indices for reopen dividers
  const offset = emails.length - visibleEmails.length;
  const dividerBeforeIndices = new Set<number>();
  for (const reopenedAt of reopenedTimestamps) {
    const ts = new Date(reopenedAt).getTime();
    const idx = emails.findIndex((e) => new Date(e.date).getTime() >= ts);
    if (idx > 0) {
      const visibleIdx = idx - offset;
      if (visibleIdx > 0 && visibleIdx < visibleEmails.length) {
        dividerBeforeIndices.add(visibleIdx);
      }
    }
  }

  // Compute newly loaded IDs on each render
  useEffect(() => {
    if (!mountedRef.current) {
      // First mount — all visible are "known", no animation
      knownIdsRef.current = new Set(visibleEmails.map((e) => e.id));
      return;
    }
    const freshIds = new Set<string>();
    for (const email of visibleEmails) {
      if (!knownIdsRef.current.has(email.id)) {
        freshIds.add(email.id);
        knownIdsRef.current.add(email.id);
      }
    }
    if (freshIds.size > 0) {
      setNewIds(freshIds);
      // Clear animation flag after animation completes
      const timer = setTimeout(() => setNewIds(new Set()), 400);
      return () => clearTimeout(timer);
    }
  }, [visibleCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on initial mount
  useEffect(() => {
    if (mountedRef.current) return;
    const scrollParent = getScrollParent(wrapperRef.current);
    if (scrollParent) {
      scrollParent.scrollTop = scrollParent.scrollHeight;
      mountedRef.current = true;
    }
  }, []);

  // Preserve scroll position when older emails are prepended
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current === 0) return;
    const scrollParent = getScrollParent(wrapperRef.current);
    if (!scrollParent) return;
    const heightDiff = scrollParent.scrollHeight - prevScrollHeightRef.current;
    if (heightDiff > 0) {
      scrollParent.scrollTop += heightDiff;
    }
    prevScrollHeightRef.current = 0;
    loadingRef.current = false;
  }, [visibleCount]);

  // IntersectionObserver on the sentinel
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || allVisible) return;
    const scrollParent = getScrollParent(wrapperRef.current);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          loadingRef.current = true;
          // Capture current scroll height before state change
          if (scrollParent) {
            prevScrollHeightRef.current = scrollParent.scrollHeight;
          }
          setVisibleCount((prev) =>
            Math.min(prev + VISIBLE_EMAILS_DEFAULT, emails.length)
          );
        }
      },
      { threshold: 0.1, root: scrollParent }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [allVisible, emails.length]);

  return (
    <div ref={wrapperRef} className="space-y-4 p-6 compact:space-y-2 compact:p-4">
      {!allVisible && (
        <div ref={sentinelRef} className="flex items-center justify-center py-2" aria-hidden="true">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {visibleEmails.map((email, index) => (
        <div
          key={email.id}
          className={newIds.has(email.id) ? "animate-in fade-in slide-in-from-top-2 duration-300" : undefined}
        >
          {dividerBeforeIndices.has(index) && (
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-1.5">
                <ArchiveRestore className="h-3 w-3" />
                <span>Previously archived</span>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <EmailMessage
            email={email}
            isFirst={index === 0 && allVisible}
            isLast={index === visibleEmails.length - 1}
          />
        </div>
      ))}
    </div>
  );
}
