import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmailyClient } from "../client.js";

export function registerMailboxTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_mailboxes",
    "List all mailboxes the current user has access to, including connection status.",
    {},
    async () => {
      const data = await client.get("/api/mailboxes");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
