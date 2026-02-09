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
export type { UnifiedProcessOptions, ThreadContext } from "./pipeline/unified-thread-processor";
