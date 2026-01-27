"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ImapConfig } from "@/lib/email/types";

/**
 * Loading spinner component
 */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
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
  );
}

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
 * Checkmark icon for success state
 */
function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * X icon for error state
 */
function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

interface ImapLoginFormProps {
  className?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ConnectionTestResult {
  imap: { success: boolean; error?: string };
  smtp: { success: boolean; error?: string };
}

/**
 * ImapLoginForm component for custom IMAP/SMTP email provider configuration.
 *
 * This client component allows users to configure their own IMAP email server
 * settings including host, port, TLS options for both incoming (IMAP) and
 * outgoing (SMTP) mail servers.
 */
export function ImapLoginForm({
  className,
  onSuccess,
  onCancel,
}: ImapLoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null);

  // Form state
  const [formData, setFormData] = React.useState<ImapConfig>({
    email: "",
    password: "",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value, 10) || 0 : value,
    }));
    // Clear test result when form changes
    setTestResult(null);
    setError(null);
  };

  const handlePortChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "imap" | "smtp"
  ) => {
    const port = parseInt(e.target.value, 10) || 0;
    setFormData((prev) => {
      // Auto-adjust secure setting based on common port conventions
      const updates: Partial<ImapConfig> = {
        [`${type}Port`]: port,
      };
      if (type === "imap") {
        updates.imapSecure = port === 993;
      } else {
        updates.smtpSecure = port === 465;
      }
      return { ...prev, ...updates };
    });
    setTestResult(null);
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.email) return "Email address is required";
    if (!formData.email.includes("@")) return "Invalid email address";
    if (!formData.password) return "Password is required";
    if (!formData.imapHost) return "IMAP host is required";
    if (!formData.imapPort || formData.imapPort < 1 || formData.imapPort > 65535) {
      return "Invalid IMAP port";
    }
    if (!formData.smtpHost) return "SMTP host is required";
    if (!formData.smtpPort || formData.smtpPort < 1 || formData.smtpPort > 65535) {
      return "Invalid SMTP port";
    }
    return null;
  };

  const handleTestConnection = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await fetch("/api/auth/imap/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Connection test failed");
        return;
      }

      setTestResult(data);
    } catch {
      setError("Failed to test connection. Please check your network.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Require successful test before saving
    if (!testResult || !testResult.imap.success || !testResult.smtp.success) {
      setError("Please test your connection settings before saving");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account");
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/inbox");
      }
    } catch {
      setError("Failed to save account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isTestSuccessful = testResult?.imap.success && testResult?.smtp.success;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <MailServerIcon className="h-6 w-6 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          Connect Custom IMAP Server
        </h2>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Account Credentials */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Account Credentials</h3>
        <div className="grid gap-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading || isTesting}
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Your email password or app password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={isLoading || isTesting}
              required
            />
          </div>
        </div>
      </div>

      {/* IMAP Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            IMAP Settings (Incoming Mail)
          </h3>
          {testResult && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                testResult.imap.success ? "text-green-600" : "text-red-600"
              )}
            >
              {testResult.imap.success ? (
                <>
                  <CheckIcon className="h-3 w-3" />
                  Connected
                </>
              ) : (
                <>
                  <XIcon className="h-3 w-3" />
                  Failed
                </>
              )}
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="imapHost"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              IMAP Host
            </label>
            <Input
              id="imapHost"
              name="imapHost"
              type="text"
              placeholder="imap.example.com"
              value={formData.imapHost}
              onChange={handleInputChange}
              disabled={isLoading || isTesting}
              required
            />
          </div>
          <div>
            <label
              htmlFor="imapPort"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              IMAP Port
            </label>
            <Input
              id="imapPort"
              name="imapPort"
              type="number"
              min={1}
              max={65535}
              placeholder="993"
              value={formData.imapPort}
              onChange={(e) => handlePortChange(e, "imap")}
              disabled={isLoading || isTesting}
              required
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="imapSecure"
            name="imapSecure"
            type="checkbox"
            checked={formData.imapSecure}
            onChange={handleInputChange}
            disabled={isLoading || isTesting}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="imapSecure" className="text-sm text-gray-600">
            Use SSL/TLS (recommended for port 993)
          </label>
        </div>
        {testResult && !testResult.imap.success && testResult.imap.error && (
          <p className="text-xs text-red-600">{testResult.imap.error}</p>
        )}
      </div>

      {/* SMTP Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            SMTP Settings (Outgoing Mail)
          </h3>
          {testResult && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                testResult.smtp.success ? "text-green-600" : "text-red-600"
              )}
            >
              {testResult.smtp.success ? (
                <>
                  <CheckIcon className="h-3 w-3" />
                  Connected
                </>
              ) : (
                <>
                  <XIcon className="h-3 w-3" />
                  Failed
                </>
              )}
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="smtpHost"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              SMTP Host
            </label>
            <Input
              id="smtpHost"
              name="smtpHost"
              type="text"
              placeholder="smtp.example.com"
              value={formData.smtpHost}
              onChange={handleInputChange}
              disabled={isLoading || isTesting}
              required
            />
          </div>
          <div>
            <label
              htmlFor="smtpPort"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              SMTP Port
            </label>
            <Input
              id="smtpPort"
              name="smtpPort"
              type="number"
              min={1}
              max={65535}
              placeholder="587"
              value={formData.smtpPort}
              onChange={(e) => handlePortChange(e, "smtp")}
              disabled={isLoading || isTesting}
              required
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="smtpSecure"
            name="smtpSecure"
            type="checkbox"
            checked={formData.smtpSecure}
            onChange={handleInputChange}
            disabled={isLoading || isTesting}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="smtpSecure" className="text-sm text-gray-600">
            Use SSL/TLS (recommended for port 465)
          </label>
        </div>
        {testResult && !testResult.smtp.success && testResult.smtp.error && (
          <p className="text-xs text-red-600">{testResult.smtp.error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading || isTesting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={isLoading || isTesting}
        >
          {isTesting ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || isTesting || !isTestSuccessful}
          className={cn(
            isTestSuccessful
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700",
            "text-white"
          )}
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Saving...
            </>
          ) : (
            "Connect Account"
          )}
        </Button>
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500">
        Common IMAP ports: 993 (SSL/TLS), 143 (STARTTLS). Common SMTP ports: 587
        (STARTTLS), 465 (SSL/TLS). If your provider requires an app-specific
        password, generate one in your email provider&apos;s security settings.
      </p>
    </form>
  );
}
