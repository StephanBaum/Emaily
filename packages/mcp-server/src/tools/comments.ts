import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerCommentTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "add_comment",
    "Add an internal comment to a thread. Comments are visible to team members only, not sent to external recipients.",
    {
      threadId: z.string().describe("The thread to comment on"),
      content: z.string().describe("Comment text"),
    },
    async ({ threadId, content }) => {
      const data = await client.post(`/api/threads/${threadId}/comments`, { content });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "list_comments",
    "Get all internal comments on a thread.",
    {
      threadId: z.string().describe("The thread ID"),
    },
    async ({ threadId }) => {
      const data = await client.get(`/api/threads/${threadId}/comments`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
