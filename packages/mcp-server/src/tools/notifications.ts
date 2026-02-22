import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerNotificationTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_notifications",
    "List notifications (AI alerts, assignments, mentions, invites).",
    {
      unreadOnly: z.boolean().optional().describe("Only return unread notifications"),
    },
    async (params) => {
      const data = await client.get("/api/notifications", {
        unreadOnly: params.unreadOnly?.toString(),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "mark_notification_read",
    "Mark a notification as read.",
    {
      notificationId: z.string().describe("The notification ID"),
    },
    async ({ notificationId }) => {
      const data = await client.patch(`/api/notifications/${notificationId}`, { read: true });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
