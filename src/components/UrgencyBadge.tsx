import { MaintenanceRequest } from "@/lib/types";

export function UrgencyBadge({ urgency }: { urgency: MaintenanceRequest["urgency"] }) {
  return <span className={`badge ${urgency}`}>{urgency === "Unrated" ? "Needs review" : urgency}</span>;
}
