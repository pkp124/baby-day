import type { BreastSide, CareEvent, DiaperKind, EventData, FeedData, FeedMethod, PumpData, Settings, SleepData, VitaminData, VitaminType } from "./types";
import { db, enqueue, getSettings, putEvent, saveSettings, tombstoneEvent } from "./db";
import { minutesAgoIso, orderedInstants, spanFromStart } from "./time";

function nowIso() {
  return new Date().toISOString();
}

function baseEvent(settings: Settings, type: CareEvent["type"], data: EventData, time: string, endedAt: string | null): CareEvent {
  const stamp = nowIso();
  return {
    id: crypto.randomUUID(),
    familyId: settings.familyId,
    babyId: settings.babyId,
    memberId: settings.caregiverId,
    memberName: settings.caregiverName,
    type,
    time,
    endedAt,
    createdAt: stamp,
    updatedAt: stamp,
    rev: 1,
    deletedAt: null,
    data,
    syncStatus: "pending",
  };
}

export type LogTime = { minutesAgo?: number; iso?: string };

function resolveTime(when?: LogTime) {
  if (when?.iso) return when.iso;
  if (when?.minutesAgo) return minutesAgoIso(when.minutesAgo);
  return nowIso();
}

export async function startBreastFeed(side: BreastSide, when?: LogTime) {
  const settings = await getSettings();
  const time = resolveTime(when);
  const data: FeedData = {
    method: "breast",
    startedOn: side,
    activeSide: side,
    sideStartedAt: time,
    leftSeconds: 0,
    rightSeconds: 0,
  };
  const event = baseEvent(settings, "feed", data, time, null);
  await putEvent(event);
  buzz();
  return event;
}

export async function logBottleFeed(input: {
  method: Extract<FeedMethod, "expressed" | "formula" | "mixed">;
  volumeMl?: number;
  formulaMl?: number;
  expressedMl?: number;
  note?: string;
  when?: LogTime;
}) {
  const settings = await getSettings();
  const time = resolveTime(input.when);
  const data: FeedData = {
    method: input.method,
    volumeMl: input.volumeMl,
    formulaMl: input.formulaMl,
    expressedMl: input.expressedMl,
    note: input.note,
  };
  const event = baseEvent(settings, "feed", data, time, time);
  await putEvent(event);
  buzz();
  return event;
}

export async function addBottleToFeed(id: string, patch: Partial<FeedData>) {
  const event = await db.events.get(id);
  if (!event || event.type !== "feed") return;
  const data = { ...(event.data as FeedData), ...patch };
  if ((data.formulaMl ?? 0) > 0 || (data.expressedMl ?? 0) > 0) data.method = "mixed";
  const next: CareEvent = {
    ...event,
    data,
    updatedAt: nowIso(),
    rev: event.rev + 1,
    syncStatus: "pending",
  };
  await putEvent(next);
  return next;
}

export async function switchFeedSide(id: string, now = new Date()) {
  const event = await db.events.get(id);
  if (!event || event.type !== "feed" || event.endedAt) return;
  const data = { ...(event.data as FeedData) };
  if (!data.activeSide || !data.sideStartedAt) return;
  const extra = Math.max(0, (now.getTime() - new Date(data.sideStartedAt).getTime()) / 1000);
  if (data.activeSide === "left") data.leftSeconds = (data.leftSeconds ?? 0) + extra;
  else data.rightSeconds = (data.rightSeconds ?? 0) + extra;
  data.activeSide = data.activeSide === "left" ? "right" : "left";
  data.sideStartedAt = now.toISOString();
  const next: CareEvent = { ...event, data, updatedAt: now.toISOString(), rev: event.rev + 1, syncStatus: "pending" };
  await putEvent(next);
  buzz();
  return next;
}

export async function endTimedEvent(id: string, now = new Date()) {
  const event = await db.events.get(id);
  if (!event || event.endedAt) return event;
  let data = event.data;
  if (event.type === "feed") {
    const feed = { ...(event.data as FeedData) };
    if (feed.activeSide && feed.sideStartedAt) {
      const extra = Math.max(0, (now.getTime() - new Date(feed.sideStartedAt).getTime()) / 1000);
      if (feed.activeSide === "left") feed.leftSeconds = (feed.leftSeconds ?? 0) + extra;
      else feed.rightSeconds = (feed.rightSeconds ?? 0) + extra;
    }
    feed.activeSide = undefined;
    feed.sideStartedAt = undefined;
    data = feed;
  }
  const next: CareEvent = {
    ...event,
    data,
    endedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    rev: event.rev + 1,
    syncStatus: "pending",
  };
  await putEvent(next);
  buzz();
  return next;
}

export async function logBreastFeed(input: {
  startedOn: BreastSide;
  leftSeconds: number;
  rightSeconds: number;
  note?: string;
  when?: LogTime;
}) {
  const settings = await getSettings();
  const leftSeconds = Math.max(0, input.leftSeconds);
  const rightSeconds = Math.max(0, input.rightSeconds);
  const { time, endedAt } = spanFromStart(resolveTime(input.when), leftSeconds + rightSeconds);
  const data: FeedData = {
    method: "breast",
    startedOn: input.startedOn,
    leftSeconds,
    rightSeconds,
    note: input.note,
  };
  const event = baseEvent(settings, "feed", data, time, endedAt);
  await putEvent(event);
  buzz();
  return event;
}

export async function startSleep(when?: LogTime) {
  const settings = await getSettings();
  const time = resolveTime(when);
  const event = baseEvent(settings, "sleep", {}, time, null);
  await putEvent(event);
  buzz();
  return event;
}

export async function logSleep(input: { start: LogTime; endedAt: string; note?: string }) {
  const settings = await getSettings();
  const time = resolveTime(input.start);
  const data: SleepData = { note: input.note };
  const [startIso, endIso] = orderedInstants(time, input.endedAt);
  const event = baseEvent(settings, "sleep", data, startIso, endIso);
  await putEvent(event);
  buzz();
  return event;
}

export async function logTemperature(celsius: number, when?: LogTime, note?: string) {
  const settings = await getSettings();
  const time = resolveTime(when);
  const event = baseEvent(settings, "temp", { celsius, note }, time, time);
  await putEvent(event);
  buzz();
  return event;
}

export async function logDiaper(kind: DiaperKind, when?: LogTime, note?: string) {
  const settings = await getSettings();
  const time = resolveTime(when);
  const event = baseEvent(settings, "diaper", { kind, note }, time, time);
  await putEvent(event);
  buzz();
  return event;
}

export async function logPump(input: { leftMl?: number; rightMl?: number; volumeMl?: number; note?: string; when?: LogTime }) {
  const settings = await getSettings();
  const time = resolveTime(input.when);
  const data: PumpData = {
    leftMl: input.leftMl,
    rightMl: input.rightMl,
    volumeMl: input.volumeMl,
    note: input.note,
  };
  const event = baseEvent(settings, "pump", data, time, time);
  await putEvent(event);
  buzz();
  return event;
}

export async function logWeight(grams: number, when?: LogTime, note?: string) {
  const settings = await getSettings();
  const time = resolveTime(when);
  const event = baseEvent(settings, "weight", { grams, note }, time, time);
  await putEvent(event);
  buzz();
  return event;
}

export async function logNote(text: string, when?: LogTime) {
  const settings = await getSettings();
  const time = resolveTime(when);
  const event = baseEvent(settings, "note", { text }, time, time);
  await putEvent(event);
  buzz();
  return event;
}

export async function logVitamin(type: VitaminType, when?: LogTime, note?: string) {
  const settings = await getSettings();
  const time = resolveTime(when);
  const data: VitaminData = note ? { note } : {};
  const event = baseEvent(settings, type, data, time, time);
  await putEvent(event);
  buzz();
  return event;
}

export async function updateEvent(id: string, patch: Partial<Pick<CareEvent, "time" | "endedAt" | "data">>) {
  const event = await db.events.get(id);
  if (!event) return;
  const next: CareEvent = {
    ...event,
    ...patch,
    updatedAt: nowIso(),
    rev: event.rev + 1,
    syncStatus: "pending",
  };
  await putEvent(next);
  return next;
}

export async function removeEvent(id: string) {
  return tombstoneEvent(id);
}

export async function restoreEvent(event: CareEvent) {
  const next = { ...event, deletedAt: null, updatedAt: nowIso(), rev: event.rev + 1, syncStatus: "pending" as const };
  await putEvent(next);
  await enqueue("upsert", event.id);
  return next;
}

export async function completeOnboarding(input: { babyName: string; caregiverName: string }) {
  return saveSettings({
    babyName: input.babyName.trim(),
    caregiverName: input.caregiverName.trim(),
    onboardedAt: nowIso(),
  });
}

function buzz() {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* ignore */
  }
}
