import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmailyClient } from "../client.js";

export function registerSyncTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "trigger_sync",
    "Trigger an IMAP sync for all accessible mailboxes. Fetches new emails from the mail server.",
    {},
    async () => {
      const data = await client.post("/api/sync");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
