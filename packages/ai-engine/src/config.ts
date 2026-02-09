import type { AIProvider } from "./providers/provider";
import { GeminiProvider } from "./providers/gemini-provider";
import { OllamaProvider } from "./providers/ollama-provider";

export interface AIConfig {
  provider: "gemini" | "ollama";
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaHost?: string;
  ollamaModel?: string;
  ollamaEmbeddingModel?: string;
}

export function createProviderFromEnv(): AIProvider {
  const explicitProvider = process.env.AI_PROVIDER;
  const geminiKey = process.env.GEMINI_API_KEY;
  const ollamaHost = process.env.OLLAMA_HOST;

  if (explicitProvider === "ollama" || (!geminiKey && !explicitProvider)) {
    return new OllamaProvider(
      ollamaHost,
      process.env.OLLAMA_MODEL,
      process.env.OLLAMA_EMBEDDING_MODEL
    );
  }

  if (geminiKey) {
    return new GeminiProvider(geminiKey, process.env.GEMINI_MODEL);
  }

  throw new Error(
    "No AI provider configured. Set GEMINI_API_KEY for Gemini or OLLAMA_HOST for Ollama."
  );
}

export function createProvider(config: AIConfig): AIProvider {
  if (config.provider === "gemini") {
    if (!config.geminiApiKey) {
      throw new Error("Gemini API key is required");
    }
    return new GeminiProvider(config.geminiApiKey, config.geminiModel);
  }

  return new OllamaProvider(
    config.ollamaHost,
    config.ollamaModel,
    config.ollamaEmbeddingModel
  );
}
