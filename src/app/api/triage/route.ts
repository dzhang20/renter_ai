import { NextResponse } from "next/server";
import { z } from "zod";
import { runTriage } from "@/lib/triage";

export const runtime = "nodejs";

const Body = z.object({
  description: z.string().max(2000).default(""),
  photoDataUrl: z.string().optional(), // "data:image/jpeg;base64,...."
});

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { description, photoDataUrl } = parsed.data;
  // Failure state: no photo or description -> the UI should have prompted already; enforce here too.
  if (!description.trim() && !photoDataUrl) {
    return NextResponse.json({ error: "Add a photo or a short description first." }, { status: 422 });
  }

  let photoBase64: string | undefined;
  let photoMediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | undefined;
  if (photoDataUrl) {
    const m = DATA_URL.exec(photoDataUrl);
    if (!m) return NextResponse.json({ error: "Unsupported image format" }, { status: 415 });
    photoMediaType = m[1] as typeof photoMediaType;
    photoBase64 = m[2];
  }

  const outcome = await runTriage({ description, photoBase64, photoMediaType, now: new Date() });
  if (!outcome.ok) console.warn("[triage] fallback:", outcome.reason, outcome.detail);
  // Always 200: a failed AI call is a normal product state (send anyway, flagged for manual review).
  return NextResponse.json(outcome);
}
