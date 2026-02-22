import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerDraftTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_drafts",
    "List shared drafts. Can filter by status (drafting, ready_for_review, sent).",
    {
      status: z.enum(["drafting", "ready_for_review", "sent"]).optional()
        .describe("Filter by draft status"),
    },
    async (params) => {
      const data = await client.get("/api/shared-drafts", {
        status: params.status,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "create_draft",
    "Create a shared draft reply for a thread. Other team members can review and edit before sending.",
    {
      threadId: z.string().describe("The thread to reply to"),
      mailboxId: z.string().describe("The mailbox to send from"),
      subject: z.string().optional().describe("Draft subject (defaults to Re: thread subject)"),
      body: z.string().describe("Draft body text"),
    },
    async (params) => {
      const data = await client.post("/api/shared-drafts", params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "update_draft",
    "Update a shared draft's body or status.",
    {
      draftId: z.string().describe("The draft ID to update"),
      body: z.string().optional().describe("Updated draft body"),
      status: z.enum(["drafting", "ready_for_review"]).optional()
        .describe("Updated draft status"),
    },
    async ({ draftId, ...updates }) => {
      const data = await client.patch(`/api/shared-drafts/${draftId}`, updates);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
