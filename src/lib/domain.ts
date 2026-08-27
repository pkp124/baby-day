import type { BreastSide, CareEvent, FeedData, PumpData } from "./types";
import { eventDurationSeconds } from "./time";

export function liveEvents(events: CareEvent[]) {
  return events.filter((e) => !e.deletedAt);
}

export function activeOfType(events: CareEvent[], type: CareEvent["type"]) {
  return liveEvents(events).find((e) => e.type === type && !e.endedAt && (type === "feed" || type === "sleep" || type === "pump"));
}

export function activeSession(events: CareEvent[]) {
  return liveEvents(events).find((e) => !e.endedAt && (e.type === "feed" || e.type === "sleep"));
}

export function feedSeconds(data: FeedData, event: CareEvent, now = new Date()) {
  let left = data.leftSeconds ?? 0;
  let right = data.rightSeconds ?? 0;
  if (!event.endedAt && data.activeSide && data.sideStartedAt) {
    const extra = Math.max(0, (now.getTime() - new Date(data.sideStartedAt).getTime()) / 1000);
    if (data.activeSide === "left") left += extra;
    else right += extra;
  }
  const total = left + right;
  if (total > 0) return { left, right, total };
  if (data.method === "breast" || data.method === "mixed") {
    const fallback = eventDurationSeconds(event.time, event.endedAt, now);
    return { left, right, total: fallback };
  }
  return { left, right, total: 0 };
}

export function bottleMl(data: FeedData) {
  if (data.method === "formula") return data.formulaMl ?? data.volumeMl ?? 0;
  if (data.method === "expressed") return data.expressedMl ?? data.volumeMl ?? 0;
  if (data.method === "mixed") return (data.formulaMl ?? 0) + (data.expressedMl ?? 0) + (data.volumeMl ?? 0);
  return data.volumeMl ?? 0;
}

export function pumpMl(data: PumpData) {
  const split = (data.leftMl ?? 0) + (data.rightMl ?? 0);
  return split > 0 ? split : data.volumeMl ?? 0;
}

export function nextBreastSide(events: CareEvent[]): BreastSide {
  const last = liveEvents(events)
    .filter((e) => e.type === "feed")
    .filter((e) => {
      const method = (e.data as FeedData).method;
      return method === "breast" || method === "mixed";
    })
    .sort((a, b) => (a.time < b.time ? 1 : -1))[0];
  if (!last || last.type !== "feed") return "left";
  const data = last.data as FeedData;
  if (data.startedOn) return data.startedOn === "left" ? "right" : "left";
  const secs = feedSeconds(data, last);
  if (secs.left === 0 && secs.right > 0) return "left";
  if (secs.right === 0 && secs.left > 0) return "right";
  return "left";
}

/** Last finished or in-progress event of a type (for "since last feed"). */
export function mostRecent(events: CareEvent[], type: CareEvent["type"]) {
  return liveEvents(events)
    .filter((e) => e.type === type)
    .sort((a, b) => (a.time < b.time ? 1 : -1))[0];
}

export function inRange(events: CareEvent[], start: Date, end: Date) {
  return liveEvents(events).filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

export type DayTotals = {
  feeds: number;
  breastFeeds: number;
  bottleMl: number;
  pumpMl: number;
  wet: number;
  dirty: number;
  sleepSeconds: number;
};

export function dayTotals(events: CareEvent[], start: Date, end: Date, now = new Date()): DayTotals {
  const rows = inRange(events, start, end);
  const totals: DayTotals = {
    feeds: 0,
    breastFeeds: 0,
    bottleMl: 0,
    pumpMl: 0,
    wet: 0,
    dirty: 0,
    sleepSeconds: 0,
  };
  for (const e of rows) {
    if (e.type === "feed") {
      totals.feeds += 1;
      const data = e.data as FeedData;
      if (data.method === "breast" || data.method === "mixed") totals.breastFeeds += 1;
      totals.bottleMl += bottleMl(data);
    } else if (e.type === "pump") {
      totals.pumpMl += pumpMl(e.data as PumpData);
    } else if (e.type === "diaper") {
      const kind = (e.data as { kind: string }).kind;
      if (kind === "wet" || kind === "both") totals.wet += 1;
      if (kind === "dirty" || kind === "both") totals.dirty += 1;
    } else if (e.type === "sleep") {
      totals.sleepSeconds += eventDurationSeconds(e.time, e.endedAt, now);
    }
  }
  return totals;
}
