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

export async function putEvent(event: CareEvent, queue = true) {
  await db.events.put(event);
  if (queue) await enqueue("upsert", event.id);
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
  await db.events.put(next);
  await enqueue("delete", id);
  return next;
}
