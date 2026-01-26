"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Available tone options for AI operations
 */
export type ComposeTone = "formal" | "casual" | "friendly" | "professional";

export interface ComposeToolbarProps {
  /** Called when AI enhance is requested */
  onEnhance?: () => void;
  /** Called when AI draft is requested */
  onDraft?: () => void;
  /** Called when tone adjustment is requested */
  onAdjustTone?: (tone: ComposeTone) => void;
  /** Called when subject generation is requested */
  onGenerateSubject?: () => void;
  /** Whether any AI operation is in progress */
  isLoading?: boolean;
  /** Currently selected tone */
  currentTone?: ComposeTone;
  /** Whether the draft has content (for conditional actions) */
  hasContent?: boolean;
  /** Whether the subject is empty */
  needsSubject?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tone options with labels
 */
const TONE_OPTIONS: { value: ComposeTone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
];

/**
 * Icons for toolbar actions
 */
const Icons = {
  sparkles: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  ),
  wand: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
      />
    </svg>
  ),
  edit: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  ),
  subject: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
      />
    </svg>
  ),
  loading: (
    <svg
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),
};

/**
 * ComposeToolbar provides AI-powered writing assistance tools.
 *
 * Features:
 * - Enhance draft: Improve grammar, clarity, and flow
 * - Draft from intent: Generate email from description
 * - Adjust tone: Change writing style (formal/casual/friendly/professional)
 * - Generate subject: Create subject line from content
 */
export function ComposeToolbar({
  onEnhance,
  onDraft,
  onAdjustTone,
  onGenerateSubject,
  isLoading = false,
  currentTone,
  hasContent = false,
  needsSubject = false,
  className,
}: ComposeToolbarProps) {
  const [showToneMenu, setShowToneMenu] = React.useState(false);
  const toneMenuRef = React.useRef<HTMLDivElement>(null);

  // Close tone menu on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toneMenuRef.current && !toneMenuRef.current.contains(event.target as Node)) {
        setShowToneMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle tone selection
  const handleToneSelect = (tone: ComposeTone) => {
    onAdjustTone?.(tone);
    setShowToneMenu(false);
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* AI Label */}
      <Badge variant="outline" className="gap-1.5 px-2 py-0.5">
        {Icons.sparkles}
        <span className="text-xs">AI Assist</span>
      </Badge>

      {/* Enhance Button - enabled when has content */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onEnhance}
        disabled={isLoading || !hasContent}
        title="Enhance draft - improve grammar and clarity"
        className="gap-1.5"
      >
        {isLoading ? Icons.loading : Icons.wand}
        <span>Enhance</span>
      </Button>

      {/* Draft Button - always enabled */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDraft}
        disabled={isLoading}
        title="Draft from intent - describe what you want to say"
        className="gap-1.5"
      >
        {isLoading ? Icons.loading : Icons.edit}
        <span>Draft</span>
      </Button>

      {/* Tone Adjuster - dropdown menu */}
      <div className="relative" ref={toneMenuRef}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowToneMenu(!showToneMenu)}
          disabled={isLoading || !hasContent}
          title="Adjust writing tone"
          className="gap-1.5"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
            />
          </svg>
          <span>Tone</span>
          {currentTone && (
            <Badge variant="secondary" className="ml-1 text-xs capitalize">
              {currentTone}
            </Badge>
          )}
        </Button>

        {/* Tone dropdown menu */}
        {showToneMenu && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[150px] rounded-md border bg-popover p-1 shadow-md">
            {TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleToneSelect(option.value)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                  currentTone === option.value && "bg-accent/50"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Generate Subject Button - enabled when needs subject and has content */}
      {needsSubject && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onGenerateSubject}
          disabled={isLoading || !hasContent}
          title="Generate subject line from content"
          className="gap-1.5"
        >
          {isLoading ? Icons.loading : Icons.subject}
          <span>Subject</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Draft intent dialog for AI-assisted drafting
 */
export interface DraftIntentDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Called when draft is submitted */
  onSubmit: (intent: string, keyPoints?: string[]) => void;
  /** Whether drafting is in progress */
  isLoading?: boolean;
}

export function DraftIntentDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: DraftIntentDialogProps) {
  const [intent, setIntent] = React.useState("");
  const [keyPoints, setKeyPoints] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setIntent("");
      setKeyPoints("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim()) return;

    const points = keyPoints
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);

    onSubmit(intent.trim(), points.length > 0 ? points : undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md mx-4 bg-background rounded-lg shadow-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          {Icons.sparkles}
          <h3 className="text-lg font-semibold">AI Draft Assistant</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="intent"
                className="block text-sm font-medium mb-1.5"
              >
                What do you want to say?
              </label>
              <textarea
                ref={textareaRef}
                id="intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="E.g., Thank the client for their feedback and schedule a follow-up meeting..."
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 resize-none"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="keyPoints"
                className="block text-sm font-medium mb-1.5"
              >
                Key points to include (optional, one per line)
              </label>
              <textarea
                id="keyPoints"
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder="Mention the new deadline&#10;Include pricing details&#10;Ask about their availability"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 resize-none"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !intent.trim()}>
              {isLoading ? (
                <>
                  {Icons.loading}
                  <span className="ml-2">Drafting...</span>
                </>
              ) : (
                <>
                  {Icons.sparkles}
                  <span className="ml-2">Generate Draft</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
