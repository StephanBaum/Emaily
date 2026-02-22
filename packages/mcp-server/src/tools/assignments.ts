import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerAssignmentTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "create_assignment",
    "Assign a thread to a team member for follow-up.",
    {
      threadId: z.string().describe("The thread to assign"),
      assignedToId: z.string().describe("User ID of the assignee"),
      note: z.string().optional().describe("Note for the assignee"),
      dueDate: z.string().optional().describe("Due date (ISO 8601 format)"),
    },
    async ({ threadId, ...body }) => {
      const data = await client.post(`/api/threads/${threadId}/assignments`, body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
