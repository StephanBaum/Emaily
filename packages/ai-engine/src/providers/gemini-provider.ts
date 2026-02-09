import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import type { AIProvider, CompletionRequest, CompletionResponse, ChatMessage } from "./provider";

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

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMessage?.content,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 4096,
        responseMimeType: request.responseFormat === "json" ? "application/json" : "text/plain",
      },
    });

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
    const model = this.client.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
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
