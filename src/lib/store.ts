import { promises as fs } from "node:fs";
import path from "node:path";
import { MaintenanceRequest, RequestStatus } from "./types";

/**
 * Prototype persistence: one JSON file. Swap for Postgres/Supabase/AppFolio API later —
 * keep the same three functions so routes don't change.
 */
const FILE = path.join(process.cwd(), "data", "requests.json");

async function readAll(): Promise<MaintenanceRequest[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeAll(items: MaintenanceRequest[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2));
}

const URGENCY_RANK: Record<MaintenanceRequest["urgency"], number> = {
  Emergency: 0,
  Unrated: 1, // unrated (AI failed) sits right under emergencies so a human looks soon
  Urgent: 2,
  Routine: 3,
};

/** Manager queue order: open before done, then by urgency, then oldest first. */
export function sortQueue(items: MaintenanceRequest[]): MaintenanceRequest[] {
  return [...items].sort((a, b) => {
    const doneA = a.status === "Done" ? 1 : 0;
    const doneB = b.status === "Done" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function listRequests(): Promise<MaintenanceRequest[]> {
  return sortQueue(await readAll());
}

export async function addRequest(req: MaintenanceRequest): Promise<void> {
  const all = await readAll();
  all.push(req);
  await writeAll(all);
}

export async function updateStatus(id: string, status: RequestStatus): Promise<MaintenanceRequest | null> {
  const all = await readAll();
  const item = all.find((r) => r.id === id);
  if (!item) return null;
  item.status = status;
  await writeAll(all);
  return item;
}
