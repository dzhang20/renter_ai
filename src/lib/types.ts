import { z } from "zod";

export const URGENCY_LEVELS = ["Emergency", "Urgent", "Routine"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Gas",
  "Fire/Smoke",
  "Locks/Security",
  "Pests",
  "Structural",
  "Cosmetic",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Exactly what the single AI call must return. Validated with zod before use. */
export const TriageResultSchema = z.object({
  urgency: z.enum(URGENCY_LEVELS),
  urgency_reason: z.string().min(1),
  safety_message: z.string().nullable(),
  until_fixed_steps: z.array(z.string()).min(1).max(2),
  title: z.string().min(1).max(80),
  category: z.enum(CATEGORIES),
  draft_request: z.string().min(1),
  technician_questions: z.array(z.string()).max(4),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

/** Saved on the device / account so the resident never retypes it. */
export interface ResidentProfile {
  name: string;
  unit: string;
  property: string;
  phone?: string;
}

export interface TriageInput {
  description: string;
  photoBase64?: string; // raw base64, no data: prefix
  photoMediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  now: Date;
}

export type TriageOutcome =
  | { ok: true; result: TriageResult }
  | { ok: false; reason: "ai_unavailable" | "malformed_reply"; detail: string };

export type RequestStatus = "New" | "Acknowledged" | "Scheduled" | "Done";

/** What lands on the property manager's queue. */
export interface MaintenanceRequest {
  id: string;
  createdAt: string;
  resident: ResidentProfile;
  description: string; // resident's original words
  photoDataUrl?: string;
  // Final, resident-reviewed fields
  urgency: Urgency | "Unrated";
  category: Category | "Uncategorized";
  title: string;
  requestText: string;
  technicianQuestions: string[];
  urgencyReason?: string;
  // AI bookkeeping so managers can judge trust
  aiSuggestedUrgency?: Urgency;
  residentChangedUrgency: boolean;
  needsManualReview: boolean;
  manualReviewReason?: string;
  status: RequestStatus;
}
