import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerEmailTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "get_email",
    "Get a single email's full content including body, headers, and attachments.",
    {
      emailId: z.string().describe("The email ID to retrieve"),
    },
    async ({ emailId }) => {
      const data = await client.get(`/api/emails/${emailId}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "send_email",
    "Send an email from a mailbox. Can be a new email or a reply to an existing thread.",
    {
      mailboxId: z.string().describe("The mailbox ID to send from"),
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body (plain text)"),
      inReplyTo: z.string().optional().describe("Message ID to reply to (for threading)"),
      cc: z.string().optional().describe("CC recipients (comma-separated)"),
    },
    async (params) => {
      const data = await client.post("/api/emails/send", params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
