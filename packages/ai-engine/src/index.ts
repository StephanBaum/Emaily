// Provider abstraction
export type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ChatMessage,
} from "./providers/provider";
export { GeminiProvider } from "./providers/gemini-provider";
export { OllamaProvider } from "./providers/ollama-provider";
export { createProviderFromEnv, createProvider } from "./config";
export type { AIConfig } from "./config";

// Pipeline classes
export { AutoTagger } from "./pipeline/auto-tagger";
export { IntentExtractor } from "./pipeline/intent-extractor";
export { DraftGenerator } from "./pipeline/draft-generator";
export { UnifiedThreadProcessor } from "./pipeline/unified-thread-processor";
export type { UnifiedProcessOptions, ThreadContext, TagInfo } from "./pipeline/unified-thread-processor";

// Agent loop
export { AgentLoop } from "./pipeline/agent-loop";
export type {
  AgentLoopOptions,
  AgentDecision,
  AgentIterationLog,
  AgentLoopResult,
  ToolExecutor,
} from "./pipeline/agent-loop";

// Agent tools
export type {
  AgentToolRequest,
  AgentToolResult,
  AgentToolDefinition,
  AgentToolExecutor,
} from "./pipeline/agent-tools";
export { AGENT_TOOL_DEFINITIONS, buildToolDescriptionsBlock } from "./pipeline/agent-tools";
