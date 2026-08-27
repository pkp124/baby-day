import Dexie, { type EntityTable } from "dexie";
import type { CareEvent, Settings } from "./types";
import { defaultSettings } from "./types";

export type MetaRow = { key: string; value: unknown };
export type OutboxRow = {
  id: string;
  op: "upsert" | "delete";
  eventId: string;
  createdAt: string;
};

class BabyDayDB extends Dexie {
  events!: EntityTable<CareEvent, "id">;
  meta!: EntityTable<MetaRow, "key">;
  outbox!: EntityTable<OutboxRow, "id">;

  constructor() {
    super("baby-day-app");
    this.version(1).stores({
      events: "id, time, type, updatedAt, deletedAt, syncStatus",
      meta: "key",
      outbox: "id, eventId, createdAt",
    });
  }
}

export const db = new BabyDayDB();

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get("settings");
  if (!row) {
    const settings = defaultSettings();
    await db.meta.put({ key: "settings", value: settings });
    return settings;
  }
  return { ...defaultSettings(), ...(row.value as Settings) };
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.meta.put({ key: "settings", value: next });
  return next;
}

export async function enqueue(op: OutboxRow["op"], eventId: string) {
  await db.outbox.put({
    id: crypto.randomUUID(),
    op,
    eventId,
    createdAt: new Date().toISOString(),
  });
}

export type PutEventOptions = { queue?: boolean; silent?: boolean };

const commitHooks = new Set<(event: CareEvent) => void>();

export function onEventCommit(hook: (event: CareEvent) => void) {
  commitHooks.add(hook);
  return () => {
    commitHooks.delete(hook);
  };
}

export async function putEvent(event: CareEvent, options: PutEventOptions | boolean = {}) {
  const opts: PutEventOptions = typeof options === "boolean" ? { queue: options } : options;
  await db.events.put(event);
  if (opts.queue !== false) await enqueue("upsert", event.id);
  if (!opts.silent) commitHooks.forEach((hook) => hook(event));
}

export async function tombstoneEvent(id: string) {
  const event = await db.events.get(id);
  if (!event) return;
  const next: CareEvent = {
    ...event,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rev: event.rev + 1,
    syncStatus: "pending",
  };
  await putEvent(next);
  return next;
}
