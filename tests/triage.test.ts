import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { parseTriage, runTriage } from "@/lib/triage";
import { sortQueue } from "@/lib/store";
import { MaintenanceRequest } from "@/lib/types";

const valid = {
  urgency: "Urgent",
  urgency_reason: "A contained slow leak can wait until morning.",
  safety_message: null,
  until_fixed_steps: ["Put a bucket under the drip."],
  title: "Slow leak under kitchen sink",
  category: "Plumbing",
  draft_request: "There is a slow leak under my kitchen sink that started [date it started].",
  technician_questions: ["Is the shutoff valve reachable?"],
};

describe("parseTriage", () => {
  it("accepts a valid reply", () => {
    const o = parseTriage(valid);
    expect(o.ok).toBe(true);
  });

  it("flags malformed replies for manual review", () => {
    const o = parseTriage({ ...valid, urgency: "Kinda bad" });
    expect(o).toMatchObject({ ok: false, reason: "malformed_reply" });
  });

  it("rejects more than four technician questions", () => {
    const o = parseTriage({ ...valid, technician_questions: ["a", "b", "c", "d", "e"] });
    expect(o.ok).toBe(false);
  });

  it("adds a safety message to emergencies that lack one", () => {
    const o = parseTriage({ ...valid, urgency: "Emergency", safety_message: null });
    expect(o.ok && o.result.safety_message).toBeTruthy();
  });
});

describe("runTriage", () => {
  it("returns ai_unavailable when the API throws", async () => {
    const fake = { messages: { create: async () => { throw new Error("529 overloaded"); } } } as unknown as Anthropic;
    const o = await runTriage({ description: "sink leak", now: new Date() }, fake);
    expect(o).toMatchObject({ ok: false, reason: "ai_unavailable" });
  });

  it("parses a forced tool_use reply", async () => {
    const fake = {
      messages: { create: async () => ({ content: [{ type: "tool_use", id: "t", name: "submit_triage", input: valid }] }) },
    } as unknown as Anthropic;
    const o = await runTriage({ description: "sink leak", now: new Date() }, fake);
    expect(o.ok).toBe(true);
  });
});

describe("sortQueue", () => {
  const mk = (id: string, urgency: MaintenanceRequest["urgency"], createdAt: string, status: MaintenanceRequest["status"] = "New") =>
    ({ id, urgency, createdAt, status } as MaintenanceRequest);

  it("puts emergencies on top, then unrated, urgent, routine; done last", () => {
    const sorted = sortQueue([
      mk("routine", "Routine", "2026-01-01"),
      mk("urgent", "Urgent", "2026-01-02"),
      mk("done-emerg", "Emergency", "2026-01-01", "Done"),
      mk("unrated", "Unrated", "2026-01-03"),
      mk("emerg", "Emergency", "2026-01-04"),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["emerg", "unrated", "urgent", "routine", "done-emerg"]);
  });
});
