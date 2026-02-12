export interface AgentToolRequest {
  tool: string;
  params: Record<string, unknown>;
  reason: string;
}

export interface AgentToolResult {
  tool: string;
  data: unknown;
  truncated?: boolean;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export type AgentToolExecutor = (
  params: Record<string, unknown>,
  teamId: string
) => Promise<AgentToolResult>;

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: "search_threads",
    description: "Find related email conversations by keyword or sender",
    parameters: {
      query: { type: "string", description: "Search query for finding related threads", required: true },
      senderEmail: { type: "string", description: "Filter by sender email address" },
      limit: { type: "number", description: "Max results to return (default 5)" },
    },
  },
  {
    name: "get_sender_profile",
    description: "Get full contact history and profile for an email address",
    parameters: {
      email: { type: "string", description: "The sender's email address", required: true },
    },
  },
  {
    name: "get_thread_detail",
    description: "Read full untruncated content of another thread",
    parameters: {
      threadId: { type: "string", description: "The thread ID to fetch", required: true },
    },
  },
  {
    name: "search_knowledge",
    description: "Search Q&A knowledge base by keyword",
    parameters: {
      query: { type: "string", description: "Search query for knowledge base", required: true },
    },
  },
  {
    name: "check_past_decisions",
    description: "See how the team handled similar emails previously",
    parameters: {
      senderEmail: { type: "string", description: "Filter by sender email" },
      tagName: { type: "string", description: "Filter by tag name" },
    },
  },
];

export function buildToolDescriptionsBlock(): string {
  return `Available tools (request via "toolRequests" array):
${AGENT_TOOL_DEFINITIONS.map((t) => {
  const params = Object.entries(t.parameters)
    .map(([name, p]) => `${name} (${p.required ? "" : "optional "}${p.type})`)
    .join(", ");
  return `- ${t.name}: ${t.description}. Params: ${params}`;
}).join("\n")}`;
}
