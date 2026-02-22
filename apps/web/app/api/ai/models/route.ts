import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get("provider") || "ollama";

  if (provider === "gemini") {
    return NextResponse.json({ models: GEMINI_MODELS });
  }

  // Ollama: fetch available models from the Ollama API
  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";

  try {
    const res = await fetch(`${ollamaHost}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { models: [], error: "Failed to reach Ollama" },
        { status: 200 }
      );
    }

    const data = await res.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json(
      { models: [], error: "Ollama is not reachable" },
      { status: 200 }
    );
  }
}
