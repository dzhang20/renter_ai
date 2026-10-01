"use client";

import { useEffect, useState } from "react";
import { MaintenanceRequest, RequestStatus } from "@/lib/types";
import { UrgencyBadge } from "@/components/UrgencyBadge";

const STATUSES: RequestStatus[] = ["New", "Acknowledged", "Scheduled", "Done"];

export default function ManagerPage() {
  const [items, setItems] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/requests", { cache: "no-store" });
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // prototype polling; swap for SSE/websocket later
    return () => clearInterval(t);
  }, []);

  async function setStatus(id: string, status: RequestStatus) {
    await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  return (
    <>
      <h2>Maintenance queue</h2>
      <p className="muted">Emergencies first, then requests needing review, then urgent and routine.</p>
      {loading && <p>Loading…</p>}
      {!loading && items.length === 0 && <p className="muted">No requests yet.</p>}
      {items.map((r) => (
        <div key={r.id} className="card queue-item" style={{ opacity: r.status === "Done" ? 0.55 : 1 }}>
          {r.photoDataUrl ? <img src={r.photoDataUrl} alt="" /> : <div className="noimg">No photo</div>}
          <div>
            <div className="row">
              <UrgencyBadge urgency={r.urgency} />
              <strong>{r.title}</strong>
            </div>
            <p className="muted" style={{ margin: "4px 0" }}>
              {r.resident.unit} · {r.resident.name} · {r.category} · {new Date(r.createdAt).toLocaleString()}
            </p>
            {r.needsManualReview && (
              <p style={{ color: "var(--unrated)", margin: "4px 0" }}>⚑ Manual review: {r.manualReviewReason}</p>
            )}
            {r.residentChangedUrgency && (
              <p className="muted" style={{ margin: "4px 0" }}>
                AI suggested {r.aiSuggestedUrgency}; resident chose {r.urgency}.
              </p>
            )}
            {r.urgencyReason && <p className="muted" style={{ margin: "4px 0" }}>Why: {r.urgencyReason}</p>}
            <details>
              <summary>Request details</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.requestText}</p>
              {r.technicianQuestions.length > 0 && (
                <>
                  <strong>Open questions</strong>
                  <ul className="compact">{r.technicianQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </>
              )}
              <p className="muted">Resident&apos;s original words: “{r.description || "—"}”</p>
            </details>
            <div className="row" style={{ marginTop: 8 }}>
              <span className="muted">Status:</span>
              <select style={{ width: "auto" }} value={r.status} onChange={(e) => setStatus(r.id, e.target.value as RequestStatus)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
