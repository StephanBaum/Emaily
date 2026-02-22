#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { EmailyClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  const config = loadConfig();
  const client = new EmailyClient(config);

  const server = new McpServer({
    name: "emaily",
    version: "0.1.0",
  });

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Emaily MCP server started");
}

main().catch((error) => {
  console.error("Failed to start Emaily MCP server:", error.message);
  process.exit(1);
});
