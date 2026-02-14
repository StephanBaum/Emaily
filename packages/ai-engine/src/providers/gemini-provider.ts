import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import type { AIProvider, CompletionRequest, CompletionResponse, ChatMessage } from "./provider";

// Timeout constants in milliseconds
const COMPLETION_TIMEOUT_MS = 120_000; // 2 minutes for completions
const EMBED_TIMEOUT_MS = 30_000; // 30 seconds for embeddings
const HEALTH_CHECK_TIMEOUT_MS = 10_000; // 10 seconds for health checks

export class GeminiProvider implements AIProvider {
  name = "gemini";
  private client: GoogleGenerativeAI;
  private model: string;
  private embeddingModel: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || "gemini-2.5-flash";
    this.embeddingModel = "text-embedding-004";
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const systemMessage = request.messages.find((m) => m.role === "system");
    const chatMessages = request.messages.filter((m) => m.role !== "system");

    const model = this.client.getGenerativeModel(
      {
        model: this.model,
        systemInstruction: systemMessage?.content,
        generationConfig: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens ?? 4096,
          responseMimeType: request.responseFormat === "json" ? "application/json" : "text/plain",
        },
      },
      { timeout: COMPLETION_TIMEOUT_MS }
    );

    const contents = this.toGeminiContents(chatMessages);
    const result = await model.generateContent({ contents });
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      content: text,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
      model: this.model,
      finishReason: response.candidates?.[0]?.finishReason === "MAX_TOKENS" ? "length" : "stop",
    };
  }

  async embed(text: string): Promise<number[]> {
    const model = this.client.getGenerativeModel(
      { model: this.embeddingModel },
      { timeout: EMBED_TIMEOUT_MS }
    );
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel(
        { model: this.model },
        { timeout: HEALTH_CHECK_TIMEOUT_MS }
      );
      await model.generateContent("test");
      return true;
    } catch {
      return false;
    }
  }

  private toGeminiContents(messages: ChatMessage[]): Content[] {
    return messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
  }
}
