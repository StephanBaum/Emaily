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

    const response = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

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
    const response = await fetch(`${this.host}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    return data.embeddings[0];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
