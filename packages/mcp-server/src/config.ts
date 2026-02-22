import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface McpConfig {
  apiKey: string;
  baseUrl: string;
}

export function loadConfig(): McpConfig {
  // 1. Environment variables (highest priority)
  const envKey = process.env.EMAILY_API_KEY;
  const envUrl = process.env.EMAILY_BASE_URL;

  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: envUrl || "http://localhost:3000",
    };
  }

  // 2. Config file
  const configPath = join(homedir(), ".emaily-mcp.json");
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (config.apiKey) {
      return {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || "http://localhost:3000",
      };
    }
  }

  throw new Error(
    "Missing EMAILY_API_KEY. Set it as an environment variable or in ~/.emaily-mcp.json"
  );
}
