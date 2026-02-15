import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { imapHost, imapPort, imapUser, imapPassword, smtpHost, smtpPort, smtpUser, smtpPassword } = body;

  const result: {
    imap: { success: boolean; folders?: string[]; error?: string };
    smtp: { success: boolean; error?: string };
  } = {
    imap: { success: false },
    smtp: { success: false },
  };

  // Test IMAP
  if (imapHost && imapUser && imapPassword) {
    try {
      const { ImapClient } = await import("@emaily/mail-engine");
      const imap = new ImapClient({
        host: imapHost,
        port: imapPort || 993,
        auth: { user: imapUser, pass: imapPassword },
      });

      await imap.connect();
      const folders = await imap.listFolders();
      await imap.disconnect();

      result.imap = { success: true, folders };
    } catch (err) {
      result.imap = { success: false, error: err instanceof Error ? err.message : "IMAP connection failed" };
    }
  }

  // Test SMTP
  if (smtpHost && smtpUser && smtpPassword) {
    try {
      const { SmtpClient } = await import("@emaily/mail-engine");
      const smtp = new SmtpClient({
        host: smtpHost,
        port: smtpPort || 587,
        auth: { user: smtpUser, pass: smtpPassword },
      });

      const verified = await smtp.verify();
      smtp.close();

      if (verified) {
        result.smtp = { success: true };
      } else {
        result.smtp = { success: false, error: "SMTP verification failed" };
      }
    } catch (err) {
      result.smtp = { success: false, error: err instanceof Error ? err.message : "SMTP connection failed" };
    }
  }

  return NextResponse.json(result);
}
