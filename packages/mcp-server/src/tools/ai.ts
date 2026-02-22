import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerAiTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "trigger_ai_processing",
    "Trigger AI processing on a thread. AI will classify, tag, extract intents, and optionally generate a draft reply.",
    {
      threadId: z.string().describe("The thread ID to process"),
    },
    async ({ threadId }) => {
      const data = await client.post("/api/ai/process", { threadId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "get_ai_summary",
    "Get an AI-generated summary of recent inbox activity including new threads, AI actions taken, and items needing attention.",
    {
      hours: z.number().min(1).max(168).optional()
        .describe("Number of hours to look back (default 24, max 168 = 1 week)"),
    },
    async (params) => {
      const data = await client.get("/api/ai/summary", {
        hours: params.hours?.toString(),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "list_agents",
    "List available AI agents. Each agent has a personality, system prompt, and can be specialized for certain tag categories.",
    {},
    async () => {
      const data = await client.get("/api/agents");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
