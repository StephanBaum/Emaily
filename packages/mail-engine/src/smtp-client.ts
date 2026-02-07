import nodemailer, { Transporter } from "nodemailer";
import { randomUUID } from "crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailMessage {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface SentEmail {
  messageId: string;
  envelope: {
    from: string;
    to: string[];
  };
  accepted: string[];
  rejected: string[];
}

export class SmtpClient {
  private transporter: Transporter;
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: config.auth,
    });
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send an email
   */
  async send(message: EmailMessage): Promise<SentEmail> {
    const messageId = `<${randomUUID()}@${this.extractDomain(message.from)}>`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: message.from,
      to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
      subject: message.subject,
      text: message.text,
      messageId,
    };

    if (message.cc) {
      mailOptions.cc = Array.isArray(message.cc) ? message.cc.join(", ") : message.cc;
    }

    if (message.bcc) {
      mailOptions.bcc = Array.isArray(message.bcc) ? message.bcc.join(", ") : message.bcc;
    }

    if (message.html) {
      mailOptions.html = message.html;
    }

    if (message.replyTo) {
      mailOptions.replyTo = message.replyTo;
    }

    if (message.inReplyTo) {
      mailOptions.inReplyTo = message.inReplyTo;
    }

    if (message.references && message.references.length > 0) {
      mailOptions.references = message.references.join(" ");
    }

    if (message.attachments && message.attachments.length > 0) {
      mailOptions.attachments = message.attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));
    }

    const result = await this.transporter.sendMail(mailOptions);

    return {
      messageId: result.messageId || messageId,
      envelope: {
        from: result.envelope?.from || message.from,
        to: result.envelope?.to || (Array.isArray(message.to) ? message.to : [message.to]),
      },
      accepted: result.accepted?.map(String) || [],
      rejected: result.rejected?.map(String) || [],
    };
  }

  /**
   * Send a reply to an existing thread
   */
  async sendReply(
    originalMessageId: string,
    originalReferences: string[],
    message: Omit<EmailMessage, "inReplyTo" | "references">
  ): Promise<SentEmail> {
    // Build references chain
    const references = [...originalReferences];
    if (!references.includes(originalMessageId)) {
      references.push(originalMessageId);
    }

    return this.send({
      ...message,
      inReplyTo: originalMessageId,
      references,
    });
  }

  /**
   * Close the transporter
   */
  close(): void {
    this.transporter.close();
  }

  private extractDomain(email: string): string {
    const match = email.match(/@([^>]+)/);
    return match ? match[1] : "local";
  }
}
