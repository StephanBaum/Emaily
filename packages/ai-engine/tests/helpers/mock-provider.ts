import type { AIProvider, CompletionRequest, CompletionResponse } from "../../src/providers/provider";

/**
 * A mock AIProvider for tests that need one.
 * Set `nextResponse` to control what `complete()` returns.
 */
export class MockProvider implements AIProvider {
  name = "mock";
  nextResponse = "";
  lastRequest: CompletionRequest | null = null;

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.lastRequest = request;
    return {
      content: this.nextResponse,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: "mock-model",
      finishReason: "stop",
    };
  }

  async embed(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
