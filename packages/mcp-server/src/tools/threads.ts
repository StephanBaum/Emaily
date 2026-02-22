import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerThreadTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_threads",
    "List email threads with optional filtering by status, mailbox, tag, or search query. Returns paginated results.",
    {
      status: z.enum(["open", "archived", "snoozed", "quarantined", "trashed", "all"]).optional()
        .describe("Filter by thread status. Defaults to 'open' (inbox)."),
      mailboxId: z.string().optional().describe("Filter by mailbox ID"),
      tagId: z.string().optional().describe("Filter by tag ID"),
      search: z.string().optional().describe("Full-text search query (min 2 chars)"),
      filter: z.enum(["unprocessed", "sent"]).optional().describe("Special filter: 'unprocessed' for AI-unprocessed threads, 'sent' for threads with sent replies"),
      limit: z.number().min(1).max(100).optional().describe("Results per page (default 20, max 100)"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
    },
    async (params) => {
      const data = await client.get<{ threads: unknown[]; pagination: unknown }>("/api/threads", {
        status: params.status,
        mailboxId: params.mailboxId,
        tagId: params.tagId,
        q: params.search,
        filter: params.filter,
        limit: params.limit?.toString(),
        cursor: params.cursor,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "get_thread",
    "Get a single thread with all its emails, tags, assignments, and comments. Use this to read the full conversation.",
    {
      threadId: z.string().describe("The thread ID to retrieve"),
    },
    async ({ threadId }) => {
      const data = await client.get(`/api/threads/${threadId}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "update_thread_status",
    "Change a thread's status: archive, snooze, trash, or reopen it.",
    {
      threadId: z.string().describe("The thread ID to update"),
      status: z.enum(["open", "archived", "snoozed", "trashed"]).describe("New status"),
    },
    async ({ threadId, status }) => {
      const data = await client.patch(`/api/threads/${threadId}/status`, { status });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "batch_update_status",
    "Change status of multiple threads at once.",
    {
      threadIds: z.array(z.string()).min(1).describe("Array of thread IDs"),
      status: z.enum(["open", "archived", "snoozed", "trashed"]).describe("New status for all threads"),
    },
    async ({ threadIds, status }) => {
      const data = await client.post("/api/threads/batch/status", { threadIds, status });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "delete_thread",
    "Move a thread to trash.",
    {
      threadId: z.string().describe("The thread ID to delete"),
    },
    async ({ threadId }) => {
      const data = await client.delete(`/api/threads/${threadId}/delete`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
