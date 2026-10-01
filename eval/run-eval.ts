/**
 * Runs text-only scenarios through the real prompt and reports agreement with the
 * expected urgency. Use it to tune URGENCY_RULES and to show managers how often
 * the AI agrees with a human call (the "would managers trust it?" assumption).
 *
 *   ANTHROPIC_API_KEY=... npm run eval
 *
 * Add photo cases later by extending cases.json with a "photo" path.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { runTriage } from "../src/lib/triage";
import type { Urgency } from "../src/lib/types";

interface Case { description: string; expected: Urgency; note?: string }

const RANK: Record<Urgency, number> = { Routine: 0, Urgent: 1, Emergency: 2 };

async function main() {
  const cases: Case[] = JSON.parse(readFileSync(path.join(__dirname, "cases.json"), "utf8"));
  let agree = 0, over = 0, under = 0, failed = 0;

  for (const c of cases) {
    const o = await runTriage({ description: c.description, now: new Date() });
    if (!o.ok) { failed++; console.log(`FAIL   ${c.description}  (${o.reason})`); continue; }
    const got = o.result.urgency;
    const tag = got === c.expected ? "OK    " : RANK[got] > RANK[c.expected] ? "OVER  " : "UNDER ";
    if (got === c.expected) agree++; else if (RANK[got] > RANK[c.expected]) over++; else under++;
    console.log(`${tag} ${c.expected.padEnd(9)} -> ${got.padEnd(9)} ${c.description}`);
  }
  console.log(`\nAgree ${agree}/${cases.length} · over-called ${over} · UNDER-called ${under} · failed ${failed}`);
  console.log("Under-calls are the dangerous ones; the prompt says to pick the more urgent level when torn.");
}

main();
