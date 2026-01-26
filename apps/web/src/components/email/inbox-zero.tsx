"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InboxZeroProps {
  /** Optional title override */
  title?: string;
  /** Optional subtitle override */
  subtitle?: string;
  /** Whether to show confetti animation */
  showConfetti?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Confetti particle component for celebration effect
 */
function ConfettiParticle({
  delay,
  color,
  left,
}: {
  delay: number;
  color: string;
  left: string;
}) {
  return (
    <div
      className={cn(
        "absolute w-2 h-2 rounded-sm opacity-0",
        "animate-[confetti-fall_3s_ease-out_forwards]",
        color
      )}
      style={{
        left,
        top: "-10px",
        animationDelay: `${delay}s`,
      }}
    />
  );
}

/**
 * Sparkle icon SVG for decoration
 */
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

/**
 * Checkmark circle icon with animation
 */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Confetti colors for celebration effect
 */
const CONFETTI_COLORS = [
  "bg-green-400",
  "bg-blue-400",
  "bg-yellow-400",
  "bg-pink-400",
  "bg-purple-400",
  "bg-orange-400",
];

/**
 * Generate confetti particles with random positions and delays
 */
function generateConfetti(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    delay: Math.random() * 2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${10 + Math.random() * 80}%`,
  }));
}

/**
 * InboxZero component displays a celebration state when inbox is empty.
 *
 * Features:
 * - Celebratory visual with checkmark icon
 * - Optional confetti animation effect
 * - Motivational messaging
 * - Subtle sparkle decorations
 * - Fully responsive design
 * - Dark mode support
 */
export function InboxZero({
  title = "Inbox Zero!",
  subtitle = "You've processed all your emails. Great job staying on top of your inbox!",
  showConfetti = true,
  className,
}: InboxZeroProps) {
  const [confetti, setConfetti] = React.useState<
    Array<{ id: number; delay: number; color: string; left: string }>
  >([]);

  // Generate confetti on mount (client-side only)
  React.useEffect(() => {
    if (showConfetti) {
      setConfetti(generateConfetti(20));
    }
  }, [showConfetti]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center py-16 text-center overflow-hidden",
        className
      )}
    >
      {/* Confetti particles */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confetti.map((particle) => (
            <ConfettiParticle
              key={particle.id}
              delay={particle.delay}
              color={particle.color}
              left={particle.left}
            />
          ))}
        </div>
      )}

      {/* Decorative sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        <SparkleIcon className="absolute top-4 left-1/4 h-5 w-5 text-yellow-400 opacity-60 animate-pulse" />
        <SparkleIcon
          className="absolute top-8 right-1/4 h-4 w-4 text-yellow-400 opacity-40 animate-pulse"
          style={{ animationDelay: "0.5s" } as React.CSSProperties}
        />
        <SparkleIcon
          className="absolute bottom-8 left-1/3 h-4 w-4 text-yellow-400 opacity-50 animate-pulse"
          style={{ animationDelay: "1s" } as React.CSSProperties}
        />
      </div>

      {/* Main celebration icon */}
      <div className="relative mb-6">
        <div
          className={cn(
            "rounded-full p-5",
            "bg-gradient-to-br from-green-100 to-emerald-100",
            "dark:from-green-900/40 dark:to-emerald-900/40",
            "shadow-lg shadow-green-100 dark:shadow-green-900/20",
            "animate-in zoom-in-50 duration-500"
          )}
        >
          <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        {/* Pulsing ring effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "border-2 border-green-400/50 dark:border-green-500/30",
            "animate-ping"
          )}
          style={{ animationDuration: "2s" }}
        />
      </div>

      {/* Title with emoji */}
      <h3
        className={cn(
          "text-2xl font-bold text-foreground mb-2",
          "animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
        )}
        style={{ animationDelay: "0.2s" }}
      >
        {title} 🎉
      </h3>

      {/* Subtitle message */}
      <p
        className={cn(
          "text-sm text-muted-foreground max-w-sm",
          "animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
        )}
        style={{ animationDelay: "0.4s" }}
      >
        {subtitle}
      </p>

      {/* Achievement badge */}
      <div
        className={cn(
          "mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-muted/50 border border-muted",
          "animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
        )}
        style={{ animationDelay: "0.6s" }}
      >
        <svg
          className="h-4 w-4 text-yellow-500"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span className="text-xs font-medium text-muted-foreground">
          Productivity Champion
        </span>
      </div>
    </div>
  );
}

/**
 * Keyframes for confetti animation - add to your global CSS:
 *
 * @keyframes confetti-fall {
 *   0% {
 *     opacity: 1;
 *     transform: translateY(0) rotate(0deg);
 *   }
 *   100% {
 *     opacity: 0;
 *     transform: translateY(300px) rotate(720deg);
 *   }
 * }
 */
