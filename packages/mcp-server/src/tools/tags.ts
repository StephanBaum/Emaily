import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerTagTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_tags",
    "List all available tags for the team. Tags can have AI actions (auto-draft, auto-reply, archive, quarantine, notify).",
    {},
    async () => {
      const data = await client.get("/api/tags");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "add_tag_to_thread",
    "Add a tag to a thread. Some tags trigger AI actions (e.g., 'Spam' quarantines the thread).",
    {
      threadId: z.string().describe("The thread ID"),
      tagId: z.string().describe("The tag ID to add"),
    },
    async ({ threadId, tagId }) => {
      const data = await client.post(`/api/threads/${threadId}/tags`, { tagId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "remove_tag_from_thread",
    "Remove a tag from a thread.",
    {
      threadId: z.string().describe("The thread ID"),
      tagId: z.string().describe("The tag ID to remove"),
    },
    async ({ threadId, tagId }) => {
      const data = await client.delete(`/api/threads/${threadId}/tags?tagId=${tagId}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
