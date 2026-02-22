import { McpHttpError } from "./client.js";

export function formatToolError(error: unknown): string {
  if (error instanceof McpHttpError) {
    switch (error.status) {
      case 401:
        return `Authentication failed: ${error.message}. Check your EMAILY_API_KEY.`;
      case 403:
        return `Permission denied: ${error.message}`;
      case 404:
        return `Not found: ${error.message}`;
      case 429:
        return `Rate limited: ${error.message}. Try again later.`;
      default:
        return `API error (${error.status}): ${error.message}`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
