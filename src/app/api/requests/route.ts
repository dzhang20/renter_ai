import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { addRequest, listRequests, updateStatus } from "@/lib/store";
import { CATEGORIES, MaintenanceRequest, URGENCY_LEVELS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NewRequest = z.object({
  resident: z.object({
    name: z.string(),
    unit: z.string(),
    property: z.string(),
    phone: z.string().optional(),
  }),
  description: z.string(),
  photoDataUrl: z.string().optional(),
  urgency: z.enum([...URGENCY_LEVELS, "Unrated"]),
  category: z.enum([...CATEGORIES, "Uncategorized"]),
  title: z.string().min(1),
  requestText: z.string().min(1),
  technicianQuestions: z.array(z.string()).max(4).default([]),
  urgencyReason: z.string().optional(),
  aiSuggestedUrgency: z.enum(URGENCY_LEVELS).optional(),
  aiFailureReason: z.string().optional(),
});

/** Manager queue, emergencies first. */
export async function GET() {
  return NextResponse.json(await listRequests());
}

/** Resident taps "Send to property manager". */
export async function POST(req: Request) {
  const parsed = NewRequest.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const residentChangedUrgency = !!b.aiSuggestedUrgency && b.aiSuggestedUrgency !== b.urgency;

  const item: MaintenanceRequest = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    resident: b.resident,
    description: b.description,
    photoDataUrl: b.photoDataUrl,
    urgency: b.urgency,
    category: b.category,
    title: b.title,
    requestText: b.requestText,
    technicianQuestions: b.technicianQuestions,
    urgencyReason: b.urgencyReason,
    aiSuggestedUrgency: b.aiSuggestedUrgency,
    residentChangedUrgency,
    needsManualReview: !b.aiSuggestedUrgency, // AI unavailable or malformed
    manualReviewReason: b.aiSuggestedUrgency ? undefined : b.aiFailureReason ?? "AI urgency check unavailable",
    status: "New",
  };
  await addRequest(item);
  // TODO: notify on-call (SMS/push) when urgency === "Emergency" or needsManualReview after hours.
  return NextResponse.json(item, { status: 201 });
}

const StatusPatch = z.object({ id: z.string(), status: z.enum(["New", "Acknowledged", "Scheduled", "Done"]) });

export async function PATCH(req: Request) {
  const parsed = StatusPatch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const updated = await updateStatus(parsed.data.id, parsed.data.status);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
