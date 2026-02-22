import { describe, it, expect } from "vitest";
import {
  AGENT_TOOL_DEFINITIONS,
  buildToolDescriptionsBlock,
} from "../src/pipeline/agent-tools";

describe("AGENT_TOOL_DEFINITIONS", () => {
  it("has exactly 5 tool definitions", () => {
    expect(AGENT_TOOL_DEFINITIONS).toHaveLength(5);
  });

  it("has the correct tool names", () => {
    const names = AGENT_TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual([
      "search_threads",
      "get_sender_profile",
      "get_thread_detail",
      "search_knowledge",
      "check_past_decisions",
    ]);
  });

  it("each tool has a name, description, and parameters", () => {
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.parameters).toBe("object");
      expect(Object.keys(tool.parameters).length).toBeGreaterThan(0);
    }
  });

  it("each parameter has type and description", () => {
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      for (const [paramName, param] of Object.entries(tool.parameters)) {
        expect(typeof param.type).toBe("string");
        expect(typeof param.description).toBe("string");
        expect(param.description.length).toBeGreaterThan(0);
        // paramName should be a non-empty string
        expect(paramName.length).toBeGreaterThan(0);
      }
    }
  });

  it("search_threads has a required query parameter", () => {
    const searchThreads = AGENT_TOOL_DEFINITIONS.find((t) => t.name === "search_threads")!;
    expect(searchThreads.parameters.query).toBeDefined();
    expect(searchThreads.parameters.query!.required).toBe(true);
  });
});

describe("buildToolDescriptionsBlock", () => {
  it("returns a non-empty string", () => {
    const result = buildToolDescriptionsBlock();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes all tool names", () => {
    const result = buildToolDescriptionsBlock();
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      expect(result).toContain(tool.name);
    }
  });

  it("includes tool descriptions", () => {
    const result = buildToolDescriptionsBlock();
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      expect(result).toContain(tool.description);
    }
  });

  it("starts with the 'Available tools' header", () => {
    const result = buildToolDescriptionsBlock();
    expect(result.startsWith("Available tools")).toBe(true);
  });
});
