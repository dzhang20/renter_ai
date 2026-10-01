import { CATEGORIES } from "./types";

/**
 * Urgency rules from Packet 2. Keep these in one place so the team can
 * tune them (and so managers can read exactly what the AI is told).
 */
export const URGENCY_RULES = `
EMERGENCY — needs help now:
- gas smell
- fire or smoke
- sparking or burning smell
- flooding that can't be stopped
- sewage backup
- no heat in freezing weather
- broken lock on an entry door
- carbon monoxide alarm

URGENT — can wait until morning:
- no AC in hot weather
- a slow leak that can be contained
- no hot water
- broken fridge

ROUTINE:
- burned out bulb
- dripping faucet
- cosmetic damage

TIE-BREAK: When torn between two levels, ALWAYS choose the more urgent one.
`.trim();

export function buildSystemPrompt(): string {
  return `You help apartment residents in metro Atlanta report maintenance problems to their property manager.
You look at the resident's photo and words and classify urgency using ONLY these rules:

${URGENCY_RULES}

Output rules:
- Call the "submit_triage" tool exactly once. Do not reply with plain text.
- urgency_reason: one sentence the resident AND the manager can check against the rules.
- safety_message: one plain sentence telling the resident what to do right now when there is a hazard
  (e.g. "Leave the apartment now and call 911 or the gas company from outside."). Use null if there is no hazard.
- until_fixed_steps: one or two safe, practical steps. Never suggest electrical, gas, or structural repairs.
- title: short, scannable (e.g. "Kitchen sink leaking under cabinet").
- category: one of ${CATEGORIES.join(", ")}.
- draft_request: a maintenance request written in first person as the resident. Use ONLY facts the resident
  gave or that are clearly visible in the photo. For anything missing, write a bracketed blank such as
  [date it started], [room], [is water still running?]. Never invent facts.
- technician_questions: up to four questions a technician would want answered before coming.
- If the photo and words disagree, trust the more dangerous interpretation and say so in urgency_reason.`;
}

export function buildUserText(description: string, now: Date, timeZone: string): string {
  const local = now.toLocaleString("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Current local time: ${local} (${timeZone}).
Resident's description: ${description.trim() || "[no description given — rely on the photo]"}`;
}

/** JSON schema for the forced tool call. Mirrors TriageResultSchema in types.ts. */
export const TRIAGE_TOOL = {
  name: "submit_triage",
  description: "Submit the urgency triage and drafted maintenance request.",
  input_schema: {
    type: "object" as const,
    properties: {
      urgency: { type: "string", enum: ["Emergency", "Urgent", "Routine"] },
      urgency_reason: { type: "string" },
      safety_message: { type: ["string", "null"] },
      until_fixed_steps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
      title: { type: "string" },
      category: { type: "string", enum: [...CATEGORIES] },
      draft_request: { type: "string" },
      technician_questions: { type: "array", items: { type: "string" }, maxItems: 4 },
    },
    required: [
      "urgency",
      "urgency_reason",
      "safety_message",
      "until_fixed_steps",
      "title",
      "category",
      "draft_request",
      "technician_questions",
    ],
  },
};
