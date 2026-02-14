import type { AIProvider, CompletionRequest, CompletionResponse } from "./provider";

interface OllamaChatResponse {
  message: { role: string; content: string };
  model: string;
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  embeddings: number[][];
}

// Timeout constants in milliseconds
const COMPLETION_TIMEOUT_MS = 120_000; // 2 minutes for completions
const EMBED_TIMEOUT_MS = 30_000; // 30 seconds for embeddings
const HEALTH_CHECK_TIMEOUT_MS = 5_000; // 5 seconds for health checks

/**
 * Create an AbortSignal that times out after the specified duration
 */
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // Clean up timeout if request completes before timeout
  controller.signal.addEventListener("abort", () => clearTimeout(timeoutId));
  return controller.signal;
}

export class OllamaProvider implements AIProvider {
  name = "ollama";
  private host: string;
  private model: string;
  private embeddingModel: string;

  constructor(host?: string, model?: string, embeddingModel?: string) {
    this.host = host || "http://localhost:11434";
    this.model = model || "llama3.2";
    this.embeddingModel = embeddingModel || "nomic-embed-text";
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.3,
        num_predict: request.maxTokens ?? 4096,
      },
    };

    if (request.responseFormat === "json") {
      body.format = "json";
    }

    let response: Response;
    try {
      response = await fetch(`${this.host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: createTimeoutSignal(COMPLETION_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Ollama completion timed out after ${COMPLETION_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaChatResponse;

    return {
      content: data.message.content,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      model: data.model,
      finishReason: "stop",
    };
  }

  async embed(text: string): Promise<number[]> {
    let response: Response;
    try {
      response = await fetch(`${this.host}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text,
        }),
        signal: createTimeoutSignal(EMBED_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Ollama embed timed out after ${EMBED_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Ollama embed error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    return data.embeddings[0];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.host}/api/tags`, {
        signal: createTimeoutSignal(HEALTH_CHECK_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
