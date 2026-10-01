# Renter Helper — The InnovAItors

Prototype for Packet 2: a resident snaps a photo of an apartment problem, taps **Check urgency**, and gets an
Emergency / Urgent / Routine call, what to do until it's fixed, and a drafted maintenance request. They edit it and
send it to the property manager, whose queue is sorted emergencies-first.

## Quick start

```bash
npm install
cp .env.example .env.local        # add ANTHROPIC_API_KEY
npm run dev                       # http://localhost:3000  (resident)  ·  /manager  (property manager)
```

Testing on a phone (camera input): run `npm run dev -- -H 0.0.0.0` and open `http://<your-laptop-ip>:3000`.

## Layout

```
src/
  lib/
    prompt.ts      Urgency rules + system prompt + tool schema   ← tune the AI here
    triage.ts      The ONE AI call (forced tool use) + validation + fallbacks
    types.ts       Zod schema for the AI reply, request/queue types
    store.ts       JSON-file persistence + emergencies-first sorting (swap for a DB later)
    profile.ts     Demo resident (name/unit pre-saved) + emergency line
    image.ts       Client-side photo downscaling
  app/
    page.tsx               Resident flow: capture → review/edit → sent
    manager/page.tsx       Manager queue: badge, photo, unit, category, status
    api/triage/route.ts    POST photo+text → triage outcome
    api/requests/route.ts  GET queue · POST new request · PATCH status
tests/triage.test.ts       Parsing, fallback, and sort-order tests (no API key needed)
eval/                      Urgency scenarios + script to measure agreement with human labels
```

## How the packet maps to code

| Packet requirement | Where |
| --- | --- |
| Photo + few words, unit/name pre-saved | `app/page.tsx`, `lib/profile.ts` |
| One AI call returning urgency, steps, category, draft, ≤4 questions, reason | `lib/triage.ts`, `lib/prompt.ts` (`TRIAGE_TOOL`) |
| Urgency rules + "pick the more urgent when torn" | `URGENCY_RULES` in `lib/prompt.ts` |
| Current time passed to the model (heat/AC in weather) | `buildUserText()` |
| Missing facts as `[bracketed blanks]` | Prompt + UI hint when blanks remain |
| AI unavailable / malformed → still sendable, flagged for manual review | `TriageOutcome` fallbacks; `needsManualReview` on the request |
| Emergency → red safety message | Banner in `app/page.tsx`; guardrail in `parseTriage()` |
| No photo or description → prompt before checking | `checkUrgency()` + 422 in the API |
| Manager queue, emergencies on top, photo/category/unit/urgency | `app/manager/page.tsx`, `sortQueue()` |

## Testing the open assumptions

- **Do residents struggle to judge urgency?** Log `aiSuggestedUrgency` vs. what residents would have picked
  (add a "what would you have chosen?" step for interviews).
- **Would managers trust the AI label?** Every request stores the AI's call, the one-sentence reason, and whether
  the resident overrode it. `npm run eval` reports agreement with human labels and counts dangerous *under-calls*
  separately — have a property manager label `eval/cases.json` themselves.

## Commands

```bash
npm test          # unit tests, no key needed
npm run eval      # live model vs. eval/cases.json (needs key)
npm run typecheck
npm run build
```

## Next steps / TODOs

- Real auth and resident roster (replace `DEMO_RESIDENT`).
- Database + photo storage (S3/Supabase) instead of base64 in a JSON file.
- Notify on-call by SMS/push for Emergency or after-hours manual-review requests (`TODO` in `api/requests`).
- Weather lookup by property ZIP so "freezing"/"hot" isn't left to the model's guess from the date.
- Integrations with AppFolio / Buildium work orders.
- Safety review of `until_fixed_steps` wording with a maintenance lead.
