import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerContactTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_contacts",
    "List contacts with trust levels. Filter by trust level or search by name/email.",
    {
      trustLevel: z.enum(["stranger", "known", "trusted", "vip"]).optional()
        .describe("Filter by trust level"),
      search: z.string().optional().describe("Search by name, email, or company"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    },
    async (params) => {
      const data = await client.get("/api/contacts", {
        trustLevel: params.trustLevel,
        search: params.search,
        limit: params.limit?.toString(),
        cursor: params.cursor,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "update_contact_trust",
    "Change a contact's trust level. Trust levels affect AI processing: strangers get quarantined, VIPs get priority.",
    {
      contactId: z.string().describe("The contact ID"),
      trustLevel: z.enum(["stranger", "known", "trusted", "vip"]).describe("New trust level"),
    },
    async ({ contactId, trustLevel }) => {
      const data = await client.post(`/api/contacts/${contactId}/trust`, { trustLevel });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
