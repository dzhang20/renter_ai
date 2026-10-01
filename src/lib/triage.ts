import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildUserText, TRIAGE_TOOL } from "./prompt";
import { TriageInput, TriageOutcome, TriageResultSchema } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const TIME_ZONE = process.env.PROPERTY_TIMEZONE || "America/New_York";

/**
 * Validate whatever the model returned. Exported so it can be unit-tested
 * without calling the API. Any failure => "malformed_reply" (manual review).
 */
export function parseTriage(raw: unknown): TriageOutcome {
  const parsed = TriageResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "malformed_reply", detail: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const r = parsed.data;
  // Guardrail: an Emergency must always carry a safety message for the red banner.
  if (r.urgency === "Emergency" && !r.safety_message) {
    r.safety_message = "This may be dangerous. If anyone is at risk, leave the area and call 911, then call the emergency maintenance line.";
  }
  return { ok: true, result: r };
}

/** The one AI call in the product. Never throws — callers always get an outcome. */
export async function runTriage(input: TriageInput, client?: Anthropic): Promise<TriageOutcome> {
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "ai_unavailable", detail: "ANTHROPIC_API_KEY is not set" };
  }
  const anthropic = client ?? new Anthropic();

  const content: Anthropic.MessageParam["content"] = [];
  if (input.photoBase64 && input.photoMediaType) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.photoMediaType, data: input.photoBase64 },
    });
  }
  content.push({ type: "text", text: buildUserText(input.description, input.now, TIME_ZONE) });

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: buildSystemPrompt(),
      tools: [TRIAGE_TOOL],
      tool_choice: { type: "tool", name: TRIAGE_TOOL.name },
      messages: [{ role: "user", content }],
    });
    const toolUse = msg.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, reason: "malformed_reply", detail: "No tool_use block in reply" };
    }
    return parseTriage(toolUse.input);
  } catch (err) {
    return { ok: false, reason: "ai_unavailable", detail: err instanceof Error ? err.message : String(err) };
  }
}
