"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImapLoginForm } from "@/components/auth/imap-login-form";
import { cn } from "@/lib/utils";

interface ImapLoginDialogProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * Mail server icon SVG component
 */
function MailServerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

/**
 * ImapLoginDialog component for connecting custom IMAP email providers.
 *
 * This client component renders a button that opens a dialog containing
 * the IMAP configuration form. It follows the same pattern as LoginButton
 * for consistency with the other auth options on the home page.
 */
export function ImapLoginDialog({
  className,
  disabled,
  ...props
}: ImapLoginDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSuccess = () => {
    setIsOpen(false);
    // The ImapLoginForm handles navigation to /inbox on success
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-3 h-12 text-base font-medium",
            "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300",
            className
          )}
          {...props}
        >
          <MailServerIcon className="h-5 w-5" />
          Connect Custom IMAP
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Connect Custom IMAP Server</DialogTitle>
          <DialogDescription>
            Configure your own IMAP email server settings
          </DialogDescription>
        </DialogHeader>
        <ImapLoginForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
