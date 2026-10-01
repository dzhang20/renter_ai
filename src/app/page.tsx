"use client";

import { useRef, useState } from "react";
import { fileToResizedDataUrl } from "@/lib/image";
import { DEMO_RESIDENT, EMERGENCY_LINE } from "@/lib/profile";
import { CATEGORIES, Category, TriageOutcome, TriageResult, URGENCY_LEVELS, Urgency } from "@/lib/types";
import { UrgencyBadge } from "@/components/UrgencyBadge";

type Step = "capture" | "review" | "sent";

export default function ResidentPage() {
  const resident = DEMO_RESIDENT;
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [photo, setPhoto] = useState<string | undefined>();
  const [description, setDescription] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  // AI result (null when AI failed) + editable fields the resident reviews
  const [ai, setAi] = useState<TriageResult | null>(null);
  const [aiFailure, setAiFailure] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<Urgency | "Unrated">("Unrated");
  const [category, setCategory] = useState<Category | "Uncategorized">("Uncategorized");
  const [title, setTitle] = useState("");
  const [requestText, setRequestText] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(await fileToResizedDataUrl(f));
    setInputError(null);
  }

  async function checkUrgency() {
    // Failure state: no photo or description -> prompt before checking
    if (!photo && !description.trim()) {
      setInputError("Add a photo or a few words about the problem first.");
      return;
    }
    if (!photo) {
      // Soft prompt: a photo helps a lot, but don't block.
      const ok = window.confirm("A photo helps maintenance a lot. Continue without one?");
      if (!ok) { fileInput.current?.click(); return; }
    }
    setChecking(true);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, photoDataUrl: photo }),
      });
      const outcome: TriageOutcome = res.ok
        ? await res.json()
        : { ok: false, reason: "ai_unavailable", detail: `HTTP ${res.status}` };
      applyOutcome(outcome);
    } catch (err) {
      applyOutcome({ ok: false, reason: "ai_unavailable", detail: String(err) });
    } finally {
      setChecking(false);
      setStep("review");
    }
  }

  function applyOutcome(o: TriageOutcome) {
    if (o.ok) {
      const r = o.result;
      setAi(r); setAiFailure(null);
      setUrgency(r.urgency); setCategory(r.category); setTitle(r.title);
      setRequestText(r.draft_request); setQuestions(r.technician_questions);
    } else {
      // Failure state: AI unavailable/malformed -> still sendable, flagged for manual review
      setAi(null); setAiFailure(o.reason);
      setUrgency("Unrated"); setCategory("Uncategorized");
      setTitle(description.slice(0, 60) || "Maintenance request");
      setRequestText(description || "[describe the problem]");
      setQuestions([]);
    }
  }

  async function send() {
    setSending(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resident, description, photoDataUrl: photo,
          urgency, category, title, requestText,
          technicianQuestions: questions.filter((q) => q.trim()),
          urgencyReason: ai?.urgency_reason,
          aiSuggestedUrgency: ai?.urgency,
          aiFailureReason: aiFailure ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStep("sent");
    } catch (err) {
      alert("Couldn't send. Please try again, or call the office. " + String(err));
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep("capture"); setPhoto(undefined); setDescription(""); setAi(null); setAiFailure(null);
  }

  const hasBlanks = /\[[^\]]+\]/.test(requestText);

  return (
    <>
      <p className="muted">{resident.name} · {resident.unit} · {resident.property}</p>

      {step === "capture" && (
        <div className="card">
          <h2>What&apos;s wrong?</h2>
          <label>Photo</label>
          <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={onPhoto} />
          {photo && <img className="photo-preview" src={photo} alt="Problem photo" />}
          <label htmlFor="desc">A few words</label>
          <textarea id="desc" placeholder="e.g. Water dripping from ceiling in bathroom"
            value={description} onChange={(e) => { setDescription(e.target.value); setInputError(null); }} />
          {inputError && <p style={{ color: "var(--emergency)" }}>{inputError}</p>}
          <button className="primary" style={{ marginTop: 16 }} onClick={checkUrgency} disabled={checking}>
            {checking ? "Checking…" : "Check urgency"}
          </button>
        </div>
      )}

      {step === "review" && (
        <>
          {urgency === "Emergency" && (
            <div className="banner emergency" role="alert">
              ⚠ {ai?.safety_message ?? "This may be dangerous."}<br />
              Then call the emergency maintenance line: {EMERGENCY_LINE}
            </div>
          )}
          {aiFailure && (
            <div className="banner warn">
              We couldn&apos;t check urgency automatically. You can still send this — the office will review it.
              If anything is dangerous (gas, smoke, flooding), call 911 or {EMERGENCY_LINE} now.
            </div>
          )}
          {ai && urgency === "Urgent" && (
            <div className="banner ok">This can likely wait until morning. Send the request and it will be handled first thing.</div>
          )}
          {ai && urgency === "Routine" && (
            <div className="banner ok">This is routine — no need to call tonight. Send the request and it will be scheduled.</div>
          )}

          <div className="card">
            <div className="row"><UrgencyBadge urgency={urgency} /><span className="muted">{category}</span></div>
            {ai && <p className="muted">Why: {ai.urgency_reason}</p>}
            {ai && (
              <>
                <strong>Until it&apos;s fixed</strong>
                <ul className="compact">{ai.until_fixed_steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
          </div>

          <div className="card">
            <h3>Review your request</h3>
            <label>Urgency</label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
              {aiFailure && <option value="Unrated">Not sure</option>}
              {URGENCY_LEVELS.map((u) => <option key={u}>{u}</option>)}
            </select>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {aiFailure && <option value="Uncategorized">Not sure</option>}
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>Request</label>
            <textarea style={{ minHeight: 160 }} value={requestText} onChange={(e) => setRequestText(e.target.value)} />
            {hasBlanks && <p className="muted">Fill in the [bracketed blanks] if you can — it saves a trip.</p>}
            {questions.length > 0 && (
              <>
                <label>Maintenance may ask (answer in your request if you can)</label>
                <ul className="compact">{questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </>
            )}
            <button className="primary" style={{ marginTop: 16 }} onClick={send} disabled={sending || !requestText.trim()}>
              {sending ? "Sending…" : "Send to property manager"}
            </button>
            <button className="secondary" style={{ marginTop: 8, width: "100%" }} onClick={() => setStep("capture")}>Back</button>
          </div>
        </>
      )}

      {step === "sent" && (
        <div className="card">
          <h2>Sent ✓</h2>
          {urgency === "Emergency"
            ? <p><strong>Call the emergency line now: {EMERGENCY_LINE}</strong>. Your written request is on file with the photo.</p>
            : <p>Your property manager has your request with the photo. No need to call tonight.</p>}
          <button className="secondary" onClick={reset}>Report something else</button>
        </div>
      )}
    </>
  );
}
