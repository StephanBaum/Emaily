import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmailyClient } from "../client.js";

export type ToolRegistrar = (server: McpServer, client: EmailyClient) => void;

import { registerThreadTools } from "./threads.js";
import { registerEmailTools } from "./email.js";
import { registerTagTools } from "./tags.js";
import { registerDraftTools } from "./drafts.js";
import { registerContactTools } from "./contacts.js";
import { registerAssignmentTools } from "./assignments.js";
import { registerCommentTools } from "./comments.js";
import { registerAiTools } from "./ai.js";
import { registerMailboxTools } from "./mailboxes.js";
import { registerNotificationTools } from "./notifications.js";
import { registerSyncTools } from "./sync.js";

export function registerAllTools(server: McpServer, client: EmailyClient): void {
  registerThreadTools(server, client);
  registerEmailTools(server, client);
  registerTagTools(server, client);
  registerDraftTools(server, client);
  registerContactTools(server, client);
  registerAssignmentTools(server, client);
  registerCommentTools(server, client);
  registerAiTools(server, client);
  registerMailboxTools(server, client);
  registerNotificationTools(server, client);
  registerSyncTools(server, client);
}
