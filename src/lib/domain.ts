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

export type MilkSplit = {
  formulaMl: number;
  expressedMl: number;
};

/** Measured bottle milk in a feed. Nursing has no millilitres. */
export function milkSplit(data: FeedData): MilkSplit {
  switch (data.method) {
    case "formula":
      return { formulaMl: data.formulaMl ?? data.volumeMl ?? 0, expressedMl: 0 };
    case "expressed":
      return { formulaMl: 0, expressedMl: data.expressedMl ?? data.volumeMl ?? 0 };
    case "mixed": {
      const formulaMl = data.formulaMl ?? 0;
      const expressedMl = data.expressedMl ?? 0;
      if (formulaMl + expressedMl > 0) return { formulaMl, expressedMl };
      return { formulaMl: data.volumeMl ?? 0, expressedMl: 0 };
    }
    case "breast":
      return { formulaMl: data.formulaMl ?? 0, expressedMl: data.expressedMl ?? 0 };
    default: {
      const _exhaustive: never = data.method;
      return _exhaustive;
    }
  }
}

export function bottleMl(data: FeedData) {
  const split = milkSplit(data);
  return split.formulaMl + split.expressedMl;
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
  fedMl: number;
  formulaMl: number;
  expressedMl: number;
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
    fedMl: 0,
    formulaMl: 0,
    expressedMl: 0,
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
      const split = milkSplit(data);
      totals.formulaMl += split.formulaMl;
      totals.expressedMl += split.expressedMl;
      totals.fedMl += split.formulaMl + split.expressedMl;
      totals.bottleMl = totals.fedMl;
    } else if (e.type === "pump") {
      totals.pumpMl += pumpMl(e.data as PumpData);
    } else if (e.type === "diaper") {
      const kind = (e.data as { kind: string }).kind;
      if (kind === "wet" || kind === "both") totals.wet += 1;
      if (kind === "dirty" || kind === "both") totals.dirty += 1;
    } else if (e.type === "sleep") {
      totals.sleepSeconds += eventDurationSeconds(e.time, e.endedAt, now);
    } else if (e.type === "weight" || e.type === "temp" || e.type === "note") {
      continue;
    } else {
      const _exhaustive: never = e.type;
      void _exhaustive;
    }
  }
  return totals;
}

/** Pumped milk minus expressed bottles, across all logged days. Not a counted inventory. */
export function fridgeEstimateMl(events: CareEvent[]) {
  let pumped = 0;
  let expressed = 0;
  for (const e of liveEvents(events)) {
    if (e.type === "pump") pumped += pumpMl(e.data as PumpData);
    else if (e.type === "feed") expressed += milkSplit(e.data as FeedData).expressedMl;
  }
  return Math.max(0, pumped - expressed);
}
