/**
 * SMTP Service
 * Handles sending emails via SMTP using nodemailer
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import {
  SendEmailOptions,
  SendEmailResult,
  ImapConfig,
  EmailProviderError,
} from "./types";

/**
 * SMTP configuration for creating the service
 */
export interface SmtpConfig {
  /** User's email address */
  email: string;
  /** Email account password */
  password: string;
  /** SMTP server hostname */
  host: string;
  /** SMTP server port (587 for STARTTLS, 465 for TLS) */
  port: number;
  /** Whether to use TLS (true for port 465) */
  secure: boolean;
}

/**
 * SMTP service class
 * Provides methods for sending emails via SMTP using nodemailer
 */
export class SmtpService {
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;
  private email: string;

  constructor(config: SmtpConfig) {
    this.email = config.email;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.email,
        pass: config.password,
      },
    });
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const {
      to,
      cc = [],
      bcc = [],
      subject,
      bodyText,
      bodyHtml,
      inReplyTo,
      attachments = [],
    } = options;

    try {
      // Build the mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.email,
        to: to.join(", "),
        subject,
        text: bodyText,
        html: bodyHtml || undefined,
      };

      // Add CC recipients
      if (cc.length > 0) {
        mailOptions.cc = cc.join(", ");
      }

      // Add BCC recipients
      if (bcc.length > 0) {
        mailOptions.bcc = bcc.join(", ");
      }

      // Add In-Reply-To header for replies
      if (inReplyTo) {
        mailOptions.inReplyTo = inReplyTo;
        mailOptions.references = inReplyTo;
      }

      // Add attachments
      if (attachments.length > 0) {
        mailOptions.attachments = attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "base64"),
          contentType: attachment.mimeType,
        }));
      }

      const result = await this.transporter.sendMail(mailOptions);

      // Generate a message ID if not provided by the server
      const messageId = result.messageId || `${Date.now()}-${Math.random().toString(36).substr(2)}`;

      return {
        messageId,
        // SMTP doesn't have threading like Gmail, use messageId as threadId
        threadId: messageId,
        // SMTP doesn't have labels
        labels: ["SENT"],
      };
    } catch (error) {
      throw this.handleError(error, "Failed to send email");
    }
  }

  /**
   * Verify SMTP connection
   * Useful for testing credentials before saving
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      throw this.handleError(error, "Failed to verify SMTP connection");
    }
  }

  /**
   * Close the transporter connection
   */
  close(): void {
    this.transporter.close();
  }

  /**
   * Handle SMTP errors
   */
  private handleError(error: unknown, message: string): EmailProviderError {
    if (error instanceof EmailProviderError) {
      return error;
    }

    const errorObj = error as { code?: string; responseCode?: number; message?: string };
    const code = errorObj?.code;
    const responseCode = errorObj?.responseCode;

    let errorType: EmailProviderError["type"] = "unknown";

    // Authentication errors
    if (
      code === "EAUTH" ||
      responseCode === 535 ||
      responseCode === 534 ||
      errorObj?.message?.includes("authentication") ||
      errorObj?.message?.includes("credentials")
    ) {
      errorType = "authentication";
    }
    // Connection/network errors
    else if (
      code === "ECONNECTION" ||
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "ESOCKET" ||
      code === "ENOTFOUND" ||
      errorObj?.message?.includes("network") ||
      errorObj?.message?.includes("ECONNREFUSED")
    ) {
      errorType = "network_error";
    }
    // Rate limiting
    else if (
      responseCode === 421 ||
      responseCode === 450 ||
      errorObj?.message?.includes("rate") ||
      errorObj?.message?.includes("too many")
    ) {
      errorType = "rate_limit";
    }
    // Invalid request (bad recipients, etc.)
    else if (
      responseCode === 550 ||
      responseCode === 551 ||
      responseCode === 552 ||
      responseCode === 553 ||
      responseCode === 554
    ) {
      errorType = "invalid_request";
    }
    // Server errors
    else if (responseCode && responseCode >= 500) {
      errorType = "server_error";
    }

    return new EmailProviderError(
      `${message}: ${errorObj?.message || "Unknown error"}`,
      errorType,
      "imap",
      error
    );
  }
}

/**
 * Create an SMTP service instance from SmtpConfig
 */
export function createSmtpService(config: SmtpConfig): SmtpService {
  return new SmtpService(config);
}

/**
 * Create an SMTP service instance from ImapConfig
 * Extracts SMTP-specific settings from the full IMAP config
 */
export function createSmtpServiceFromImapConfig(config: ImapConfig): SmtpService {
  return new SmtpService({
    email: config.email,
    password: config.password,
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
  });
}
