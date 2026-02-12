import type { AIProvider, ChatMessage } from "../providers/provider";
import type {
  EmailIntent,
  DraftConfidence,
  ThreadTriage,
  EscalationResult,
} from "@emailautomation/shared";
import type { ThreadContext, TagInfo } from "./unified-thread-processor";
import type { AgentToolRequest, AgentToolResult } from "./agent-tools";
import { buildToolDescriptionsBlock } from "./agent-tools";

const MAX_ITERATIONS = 3;
const MAX_TOOLS_PER_ITERATION = 3;

export interface AgentLoopOptions {
  subject: string;
  emails: { from: string; body: string; date: Date; isSent: boolean }[];
  availableTags: TagInfo[];
  qaPairs: { triggerPatterns: string[]; idealResponse: string }[];
  agentPersonality?: string;
  generateDraft: boolean;
  replyTo: string;
  temperature?: number;
  threadContext?: ThreadContext;
  agentName?: string;
  userName?: string;
  userEmail?: string;
}

export interface AgentDecision {
  tags: { name: string; confidence: number }[];
  intents: EmailIntent[];
  triage: ThreadTriage;
  draft: { subject: string; body: string; confidence: DraftConfidence } | null;
  escalate: boolean;
  escalation?: EscalationResult;
}

export interface AgentIterationLog {
  iteration: number;
  thinking: string;
  toolRequests: AgentToolRequest[];
  toolResults: AgentToolResult[];
  readyToDecide: boolean;
}

export interface AgentLoopResult {
  decision: AgentDecision;
  iterations: AgentIterationLog[];
  totalIterations: number;
}

export type ToolExecutor = (
  toolName: string,
  params: Record<string, unknown>,
  teamId: string
) => Promise<AgentToolResult>;

export class AgentLoop {
  constructor(private provider: AIProvider) {}

  async run(
    options: AgentLoopOptions,
    teamId: string,
    executeToolFn: ToolExecutor
  ): Promise<AgentLoopResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(options) },
      { role: "user", content: this.buildInitialUserMessage(options) },
    ];

    const iterations: AgentIterationLog[] = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.provider.complete({
        messages,
        temperature: options.temperature ?? 0.3,
        responseFormat: "json",
      });

      const parsed = this.parseResponse(response.content);
      const iterLog: AgentIterationLog = {
        iteration: i + 1,
        thinking: parsed.thinking || "",
        toolRequests: parsed.toolRequests || [],
        toolResults: [],
        readyToDecide: parsed.readyToDecide ?? false,
      };

      // Append assistant message to conversation history
      messages.push({ role: "assistant", content: response.content });

      if (parsed.readyToDecide || i === MAX_ITERATIONS - 1) {
        iterLog.readyToDecide = true;
        iterations.push(iterLog);

        const decision = this.extractDecision(parsed, options.availableTags);
        return {
          decision,
          iterations,
          totalIterations: i + 1,
        };
      }

      // Execute tool requests
      const toolRequests = (parsed.toolRequests || []).slice(0, MAX_TOOLS_PER_ITERATION);
      const toolResults: AgentToolResult[] = [];

      for (const req of toolRequests) {
        const result = await executeToolFn(req.tool, req.params, teamId);
        toolResults.push(result);
      }

      iterLog.toolResults = toolResults;
      iterations.push(iterLog);

      // Inject tool results as user message for next iteration
      if (toolResults.length > 0) {
        const toolResultsText = toolResults
          .map((r) => `Tool "${r.tool}" result:\n${JSON.stringify(r.data, null, 2)}${r.truncated ? "\n(result was truncated)" : ""}`)
          .join("\n\n");

        messages.push({
          role: "user",
          content: `Here are the results from your tool requests:\n\n${toolResultsText}\n\nBased on this information, continue your analysis. Set "readyToDecide": true when you have enough information, or request more tools if needed.`,
        });
      } else {
        // No tools requested but not ready to decide — force decision on next iteration
        messages.push({
          role: "user",
          content: "You didn't request any tools. Please make your decision now by setting \"readyToDecide\": true.",
        });
      }
    }

    // Should not reach here, but fallback to empty decision
    return {
      decision: this.emptyDecision(),
      iterations,
      totalIterations: MAX_ITERATIONS,
    };
  }

  private buildSystemPrompt(options: AgentLoopOptions): string {
    const tagBlock = options.availableTags.length > 0
      ? options.availableTags.map((t) => {
          const parts = [`- ${t.name}`];
          if (t.description) parts[0] += `: ${t.description}`;
          if (t.aiAction && t.aiAction !== "none") parts[0] += ` (action: ${t.aiAction})`;
          return parts[0];
        }).join("\n")
      : "(none)";

    const qaBlock = options.qaPairs.length > 0
      ? "\n\nQ&A Knowledge Base:\n" +
        options.qaPairs.map((qa) => `Q: ${qa.triggerPatterns[0]}\nA: ${qa.idealResponse}`).join("\n\n")
      : "";

    const personalityBlock = options.agentPersonality
      ? `\n\nAgent personality for drafting:\n${options.agentPersonality}`
      : "";

    const toolsBlock = buildToolDescriptionsBlock();

    const signatureInfo = options.agentName && options.userName
      ? `\n\nEmail signature: End every draft with a line break, then:\n${options.agentName} (AI) on behalf of ${options.userName}\n${options.userEmail || ""}`
      : options.userName
        ? `\n\nEmail signature: End every draft with a line break, then:\nBest regards,\n${options.userName}`
        : "";

    const draftInstruction = options.generateDraft
      ? `If you decide to generate a draft reply, address it to ${options.replyTo}. Address all extracted intents. Use Q&A material when relevant.${signatureInfo}`
      : `Draft generation is not requested for this thread.`;

    return `You are an intelligent email agent that analyzes email threads, classifies them, and optionally drafts replies.

You work in an iterative loop:
1. ASSESS: Analyze the thread and determine if you have enough context to decide
2. RESEARCH: Use tools to gather more information if needed
3. DECIDE: Make your final classification and draft decision

${toolsBlock}

Available tags:
${tagBlock}${qaBlock}${personalityBlock}

${draftInstruction}

CRITICAL DRAFTING RULES:
- Write in PLAIN TEXT only. No markdown, no bold (**), no italic (*), no bullet points (- or *), no headers (#). Use plain line breaks and spacing for structure.
- NEVER use placeholder brackets like [company name], [your name], [specific detail]. Use the actual information from the thread context, sender profile, and knowledge base. If you don't have specific information, write around it naturally or omit the detail entirely.
- Write complete, ready-to-send emails. The user should not need to edit or fill in any blanks.
- Be specific and reference actual details from the conversation.

Respond with ONLY valid JSON in this format:
{
  "thinking": "Your chain-of-thought reasoning about this thread...",
  "toolRequests": [
    {"tool": "tool_name", "params": {...}, "reason": "Why you need this info"}
  ],
  "readyToDecide": false,
  "decision": null
}

When readyToDecide is true, include the decision:
{
  "thinking": "Final reasoning...",
  "toolRequests": [],
  "readyToDecide": true,
  "decision": {
    "tags": [{"name": "TagName", "confidence": 0.9}],
    "intents": [{"type": "question", "text": "What is X?", "priority": 1}],
    "triage": {"priority": "medium", "needsReply": true, "reasoning": "..."},
    "draft": {"subject": "Re: ...", "body": "plain text email body", "confidence": {"overall": 0.8, "intentCoverage": 0.9, "qaMatchStrength": 0.7, "ragRelevance": 0.0, "toneConsistency": 0.9}} or null,
    "escalate": false,
    "escalation": null
  }
}

Rules:
- tags: Only use tags from the available list. confidence 0.0-1.0. Be selective.
- intents: type must be "question", "request", or "info". priority 1-3. Max 10.
- triage: Assess priority (high/medium/low) and whether a reply is needed.
- draft: null if not generating or unable. confidence scores all 0.0-1.0. PLAIN TEXT ONLY.
- escalate: Set true if you are uncertain (overall confidence < 0.4) or cannot handle the email.
- escalation: Only when escalate is true. Include reason and suggestedAction.
- Maximum 3 tool requests per iteration, 3 iterations total.
- For simple emails (newsletters, notifications), decide immediately without tools.`;
  }

  private buildInitialUserMessage(options: AgentLoopOptions): string {
    // Build thread conversation with smart truncation
    const FULL_BODY_COUNT = 3;
    const MAX_TOTAL_CHARS = 8000;
    let totalChars = 0;

    const reversedEmails = [...options.emails].reverse();
    const emailBodies: { index: number; line: string }[] = [];

    for (let i = 0; i < reversedEmails.length; i++) {
      const e = reversedEmails[i];
      const direction = e.isSent ? "[SENT]" : "[RECEIVED]";
      let body: string;

      if (i < FULL_BODY_COUNT) {
        body = e.body;
      } else {
        body = e.body.length > 300 ? e.body.slice(0, 300) + "... [older email truncated]" : e.body;
      }

      if (totalChars + body.length > MAX_TOTAL_CHARS && i >= FULL_BODY_COUNT) {
        body = e.body.slice(0, 150) + "... [truncated for token budget]";
      }
      totalChars += body.length;

      emailBodies.push({
        index: reversedEmails.length - 1 - i,
        line: `${direction} From: ${e.from} (${e.date.toISOString()})\n${body}`,
      });
    }

    emailBodies.sort((a, b) => a.index - b.index);

    // Build context block
    let contextBlock = "";
    if (options.threadContext) {
      const parts: string[] = [];
      const tc = options.threadContext;
      if (tc.existingTags.length > 0) parts.push(`Already applied tags: ${tc.existingTags.join(", ")}`);
      if (tc.previousActivity.length > 0) parts.push(`Previous AI actions:\n${tc.previousActivity.join("\n")}`);
      if (tc.teamComments.length > 0) parts.push(`Team comments:\n${tc.teamComments.map((c) => `- ${c.author}: ${c.text}`).join("\n")}`);
      if (tc.previousDraft) parts.push(`Previous draft reply:\n${tc.previousDraft}`);
      if (tc.senderTrust) parts.push(tc.senderTrust);
      if (tc.senderProfile) {
        const p = tc.senderProfile;
        const profileLines = ["Sender profile:"];
        if (p.name) profileLines.push(`  Name: ${p.name}`);
        if (p.company) profileLines.push(`  Company: ${p.company}`);
        if (p.domain) profileLines.push(`  Domain: ${p.domain}`);
        profileLines.push(`  Interactions: ${p.interactionCount}, Replied to: ${p.repliedToCount}`);
        if (p.notes) profileLines.push(`  Notes: ${p.notes}`);
        parts.push(profileLines.join("\n"));
      }
      if (tc.assignments && tc.assignments.length > 0) {
        parts.push(`Assignments:\n${tc.assignments.map((a) => `- ${a.assignedTo} (${a.status})${a.dueDate ? ` due ${a.dueDate}` : ""}`).join("\n")}`);
      }
      if (tc.attachments && tc.attachments.length > 0) {
        parts.push(`Attachments:\n${tc.attachments.map((a) => `- ${a.filename} (${a.contentType}, ${Math.round(a.size / 1024)}KB)`).join("\n")}`);
      }
      if (tc.threadAge) parts.push(`Thread age: ${tc.threadAge}`);
      if (parts.length > 0) contextBlock = "\n\n--- Existing Context ---\n" + parts.join("\n\n");
    }

    return `Analyze this email thread:

Subject: ${options.subject}

--- Thread ---
${emailBodies.map((e) => e.line).join("\n\n---\n\n")}
--- End Thread ---${contextBlock}`;
  }

  private parseResponse(content: string): {
    thinking?: string;
    toolRequests?: AgentToolRequest[];
    readyToDecide?: boolean;
    decision?: Record<string, unknown>;
  } {
    try {
      return JSON.parse(content);
    } catch {
      console.error("[AgentLoop] Failed to parse LLM response:", content.slice(0, 200));
      return { readyToDecide: true };
    }
  }

  private extractDecision(
    parsed: Record<string, unknown>,
    availableTags: TagInfo[]
  ): AgentDecision {
    const decision = (parsed.decision || parsed) as Record<string, unknown>;
    const tagNameSet = new Set(availableTags.map((t) => t.name.toLowerCase()));

    const tags = this.validateTags(decision.tags, tagNameSet);
    const intents = this.validateIntents(decision.intents);
    const triage = this.validateTriage(decision.triage);
    const draft = this.validateDraft(decision.draft);
    const escalate = Boolean(decision.escalate);
    const escalation = escalate ? this.validateEscalation(decision.escalation, tags, draft) : undefined;

    return { tags, intents, triage, draft, escalate, escalation };
  }

  private validateTags(raw: unknown, validNames: Set<string>): { name: string; confidence: number }[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is { name: string; confidence: number } =>
        typeof item?.name === "string" &&
        typeof item?.confidence === "number" &&
        item.confidence >= 0.5 &&
        validNames.has(item.name.toLowerCase())
      )
      .map((item) => ({
        name: item.name,
        confidence: Math.min(1, Math.max(0, item.confidence)),
      }));
  }

  private validateIntents(raw: unknown): EmailIntent[] {
    if (!Array.isArray(raw)) return [];
    const validTypes = new Set(["question", "request", "info"]);
    return raw
      .filter((item): item is { type: string; text: string; priority: number } =>
        typeof item?.type === "string" &&
        validTypes.has(item.type) &&
        typeof item?.text === "string" &&
        item.text.length > 0
      )
      .slice(0, 10)
      .map((item) => ({
        type: item.type as EmailIntent["type"],
        text: item.text,
        priority: Math.min(3, Math.max(1, Math.round(item.priority ?? 2))),
      }));
  }

  private validateTriage(raw: unknown): ThreadTriage {
    if (!raw || typeof raw !== "object") {
      return { priority: "medium", needsReply: true, reasoning: "No triage provided" };
    }
    const t = raw as Record<string, unknown>;
    const validPriorities = new Set(["high", "medium", "low"]);
    return {
      priority: (validPriorities.has(String(t.priority)) ? t.priority : "medium") as ThreadTriage["priority"],
      needsReply: typeof t.needsReply === "boolean" ? t.needsReply : true,
      reasoning: typeof t.reasoning === "string" ? t.reasoning : "",
    };
  }

  private validateDraft(raw: unknown): AgentDecision["draft"] {
    if (!raw || typeof raw !== "object") return null;
    const d = raw as Record<string, unknown>;
    if (typeof d.subject !== "string" || typeof d.body !== "string" || !d.body.trim()) return null;

    const clamp = (v: unknown): number => {
      const n = typeof v === "number" ? v : 0;
      return Math.min(1, Math.max(0, n));
    };

    const conf = (d.confidence as Record<string, unknown>) || {};
    return {
      subject: d.subject,
      body: d.body,
      confidence: {
        overall: clamp(conf.overall),
        intentCoverage: clamp(conf.intentCoverage),
        qaMatchStrength: clamp(conf.qaMatchStrength),
        ragRelevance: clamp(conf.ragRelevance),
        toneConsistency: clamp(conf.toneConsistency),
      },
    };
  }

  private validateEscalation(
    raw: unknown,
    tags: { name: string; confidence: number }[],
    draft: AgentDecision["draft"]
  ): EscalationResult {
    if (!raw || typeof raw !== "object") {
      return { reason: "Agent indicated escalation", suggestedAction: "Review manually" };
    }
    const e = raw as Record<string, unknown>;
    return {
      reason: typeof e.reason === "string" ? e.reason : "Agent indicated escalation",
      suggestedAction: typeof e.suggestedAction === "string" ? e.suggestedAction : "Review manually",
      partialWork: tags.length > 0 || draft ? { tags, draft } : undefined,
    };
  }

  private emptyDecision(): AgentDecision {
    return {
      tags: [],
      intents: [],
      triage: { priority: "medium", needsReply: false, reasoning: "Agent loop exhausted iterations" },
      draft: null,
      escalate: true,
      escalation: { reason: "Agent loop exhausted without a decision", suggestedAction: "Review manually" },
    };
  }
}
