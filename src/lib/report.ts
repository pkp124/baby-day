import type { CareEvent, DiaperData, FeedData, PumpData, Settings, TempData } from "./types";
import {
  bottleMl,
  dayTotals,
  feedSeconds,
  fridgeEstimateMl,
  latestInRange,
  liveEvents,
  milkSplit,
  pumpMl,
  vitaminLabel,
  type DayTotals,
} from "./domain";
import { careDayFor, formatClock, formatDuration, fromZonedLocal, zonedParts, type CareDay } from "./time";
import { formatMl, formatTemp } from "./units";
import { describeEvent } from "./summary";

export const REPORT_HOURS = 72;

export type ClippedSpan = {
  id: string;
  type: CareEvent["type"];
  startMs: number;
  endMs: number;
  inProgress: boolean;
  label: string;
};

export type ReportPoint = {
  id: string;
  type: CareEvent["type"];
  atMs: number;
  label: string;
};

export type FeedMethodCounts = {
  breast: number;
  formula: number;
  expressed: number;
  mixed: number;
};

export type TempSample = {
  id: string;
  time: string;
  atMs: number;
  celsius: number;
};

export type CareDaySlice = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  sliceStart: Date;
  sliceEnd: Date;
  partial: boolean;
  totals: DayTotals;
  sleepSeconds: number;
  sleepPct: number;
  vitaminD: boolean;
  vitaminK: boolean;
  vitaminDAt: string | null;
  vitaminKAt: string | null;
};

export type WeightSample = {
  id: string;
  time: string;
  atMs: number;
  grams: number;
};

export type LifetimeDay = {
  key: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
  partial: boolean;
  sleepSeconds: number;
  sleepHours: number;
  milkMl: number;
  formulaMl: number;
  expressedMl: number;
  diapers: number;
  wet: number;
  dirty: number;
  lastTempC: number | null;
  lastWeightGrams: number | null;
};

export type LifetimeTrends = {
  dayCount: number;
  days: LifetimeDay[];
  temps: TempSample[];
  weights: WeightSample[];
  medianSleepHours: number | null;
  medianMilkMl: number | null;
  medianDiapers: number | null;
  firstAt: string | null;
  lastWeightGrams: number | null;
  lastWeightAt: string | null;
};

export type ReportModel = {
  hours: number;
  start: Date;
  end: Date;
  durationSeconds: number;
  babyName: string;
  timezone: string;
  generatedAt: Date;
  sleepSeconds: number;
  sleepPct: number;
  awakeSeconds: number;
  sleepCount: number;
  longestSleepSeconds: number;
  longestAwakeSeconds: number;
  feeds: number;
  breastSeconds: number;
  methods: FeedMethodCounts;
  bottleMl: number;
  formulaMl: number;
  expressedMl: number;
  pumpMl: number;
  wet: number;
  dirty: number;
  medianFeedGapMinutes: number | null;
  meanFeedGapMinutes: number | null;
  fridgeMl: number;
  days: CareDaySlice[];
  sleepSpans: ClippedSpan[];
  feedSpans: ClippedSpan[];
  diapers: ReportPoint[];
  pumps: ReportPoint[];
  temps: ReportPoint[];
  weights: ReportPoint[];
  vitamins: ReportPoint[];
  notes: ReportPoint[];
  tempSamples: TempSample[];
  tempMinC: number | null;
  tempMaxC: number | null;
  lastWeightGrams: number | null;
  lastWeightAt: string | null;
  eventLog: CareEvent[];
  lifetime: LifetimeTrends;
};

export type Interval = { startMs: number; endMs: number };

export function reportWindow(now = new Date(), hours = REPORT_HOURS) {
  const end = now.getTime();
  const start = end - hours * 60 * 60 * 1000;
  return { start: new Date(start), end: now, hours };
}

export function clipInterval(startMs: number, endMs: number, winStart: number, winEnd: number): Interval | null {
  const clippedStart = Math.max(startMs, winStart);
  const clippedEnd = Math.min(endMs, winEnd);
  if (clippedEnd <= clippedStart) return null;
  return { startMs: clippedStart, endMs: clippedEnd };
}

export function mergeIntervals(spans: Interval[]): Interval[] {
  const sorted = [...spans].sort((a, b) => a.startMs - b.startMs);
  const out: Interval[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (!last || span.startMs > last.endMs) out.push({ ...span });
    else last.endMs = Math.max(last.endMs, span.endMs);
  }
  return out;
}

export function intervalSeconds(spans: Interval[]) {
  return mergeIntervals(spans).reduce((sum, span) => sum + (span.endMs - span.startMs) / 1000, 0);
}

export function gapMs(spans: Interval[], winStart: number, winEnd: number) {
  const merged = mergeIntervals(spans);
  const gaps: number[] = [];
  let cursor = winStart;
  for (const span of merged) {
    if (span.startMs > cursor) gaps.push(span.startMs - cursor);
    cursor = Math.max(cursor, span.endMs);
  }
  if (winEnd > cursor) gaps.push(winEnd - cursor);
  return gaps;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function eventEndMs(event: CareEvent, now: Date) {
  if (event.endedAt) return new Date(event.endedAt).getTime();
  if (event.type === "feed" || event.type === "sleep") return now.getTime();
  return new Date(event.time).getTime();
}

export function eventOverlapsWindow(event: CareEvent, winStart: number, winEnd: number, now: Date) {
  const startMs = new Date(event.time).getTime();
  const endMs = Math.max(startMs, eventEndMs(event, now));
  return endMs > winStart && startMs < winEnd;
}

function careDaysOverlapping(start: Date, end: Date, timeZone: string, startHour: number): CareDay[] {
  const days: CareDay[] = [];
  let cursor = careDayFor(start, timeZone, startHour);
  const endMs = end.getTime();
  while (cursor.start.getTime() < endMs) {
    days.push(cursor);
    cursor = careDayFor(cursor.end, timeZone, startHour);
  }
  return days;
}

function formatDayLabel(day: CareDay, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(fromZonedLocal(timeZone, day.year, day.month, day.day, 12));
}

function formatShortDay(day: CareDay, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: "numeric",
    day: "numeric",
  }).format(fromZonedLocal(timeZone, day.year, day.month, day.day, 12));
}

export function formatReportStamp(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function pointLabel(event: CareEvent, settings: Settings, now: Date) {
  return describeEvent(event, settings, now);
}

function feedSpanLabel(event: CareEvent, settings: Settings, durationSeconds: number) {
  const data = event.data as FeedData;
  const bits: string[] = [data.method];
  if (durationSeconds >= 60) bits.push(formatDuration(durationSeconds));
  const ml = bottleMl(data);
  if (ml) bits.push(formatMl(ml, settings.volumeUnit));
  return bits.join(" · ");
}

export function sleepIntervals(events: CareEvent[], winStart: number, winEnd: number, now: Date): Interval[] {
  const raw: Interval[] = [];
  for (const event of liveEvents(events)) {
    if (event.type !== "sleep") continue;
    const startMs = new Date(event.time).getTime();
    const endMs = eventEndMs(event, now);
    const clipped = clipInterval(startMs, endMs, winStart, winEnd);
    if (clipped) raw.push(clipped);
  }
  return mergeIntervals(raw);
}

function emptyLifetime(): LifetimeTrends {
  return {
    dayCount: 0,
    days: [],
    temps: [],
    weights: [],
    medianSleepHours: null,
    medianMilkMl: null,
    medianDiapers: null,
    firstAt: null,
    lastWeightGrams: null,
    lastWeightAt: null,
  };
}

export function buildLifetimeTrends(events: CareEvent[], settings: Settings, now = new Date()): LifetimeTrends {
  const live = liveEvents(events);
  if (live.length === 0) return emptyLifetime();

  const firstAt = live.reduce((min, event) => (event.time < min ? event.time : min), live[0].time);
  const firstDay = careDayFor(new Date(firstAt), settings.timezone, settings.careDayStartHour);
  const days = careDaysOverlapping(firstDay.start, now, settings.timezone, settings.careDayStartHour).map((day) => {
    const sliceEndMs = Math.min(day.end.getTime(), now.getTime());
    const sliceStartMs = day.start.getTime();
    const dayLen = Math.max(1, (day.end.getTime() - day.start.getTime()) / 1000);
    const sliceSeconds = Math.max(1, (sliceEndMs - sliceStartMs) / 1000);
    const totals = dayTotals(live, day.start, new Date(sliceEndMs), now);
    const sleepSec = intervalSeconds(sleepIntervals(live, sliceStartMs, sliceEndMs, now));
    const dayEvents = live.filter((event) => {
      const t = new Date(event.time).getTime();
      return t >= sliceStartMs && t < sliceEndMs;
    });
    const lastTemp = dayEvents
      .filter((event) => event.type === "temp")
      .sort((a, b) => (a.time < b.time ? 1 : -1))[0];
    const lastWeight = dayEvents
      .filter((event) => event.type === "weight")
      .sort((a, b) => (a.time < b.time ? 1 : -1))[0];
    const diapers = dayEvents.filter((event) => event.type === "diaper").length;
    return {
      key: day.key,
      label: formatDayLabel(day, settings.timezone),
      shortLabel: formatShortDay(day, settings.timezone),
      start: day.start,
      end: day.end,
      partial: sliceSeconds / dayLen < 0.95,
      sleepSeconds: sleepSec,
      sleepHours: sleepSec / 3600,
      milkMl: totals.fedMl,
      formulaMl: totals.formulaMl,
      expressedMl: totals.expressedMl,
      diapers,
      wet: totals.wet,
      dirty: totals.dirty,
      lastTempC: lastTemp && lastTemp.type === "temp" ? (lastTemp.data as TempData).celsius : null,
      lastWeightGrams: lastWeight && lastWeight.type === "weight" ? (lastWeight.data as { grams: number }).grams : null,
    } satisfies LifetimeDay;
  });

  const complete = days.filter((day) => !day.partial);
  const forMedian = complete.length > 0 ? complete : days;
  const lastWeight = live
    .filter((event) => event.type === "weight")
    .sort((a, b) => (a.time < b.time ? 1 : -1))[0];

  return {
    dayCount: days.length,
    days,
    temps: live
      .filter((event) => event.type === "temp")
      .map((event) => ({
        id: event.id,
        time: event.time,
        atMs: new Date(event.time).getTime(),
        celsius: (event.data as TempData).celsius,
      }))
      .sort((a, b) => a.atMs - b.atMs),
    weights: live
      .filter((event) => event.type === "weight")
      .map((event) => ({
        id: event.id,
        time: event.time,
        atMs: new Date(event.time).getTime(),
        grams: (event.data as { grams: number }).grams,
      }))
      .sort((a, b) => a.atMs - b.atMs),
    medianSleepHours: median(forMedian.map((day) => day.sleepHours)),
    medianMilkMl: median(forMedian.map((day) => day.milkMl)),
    medianDiapers: median(forMedian.map((day) => day.diapers)),
    firstAt,
    lastWeightGrams: lastWeight && lastWeight.type === "weight" ? (lastWeight.data as { grams: number }).grams : null,
    lastWeightAt: lastWeight ? lastWeight.time : null,
  };
}

export function buildReport(events: CareEvent[], settings: Settings, now = new Date(), hours = REPORT_HOURS): ReportModel {
  const window = reportWindow(now, hours);
  const winStart = window.start.getTime();
  const winEnd = window.end.getTime();
  const durationSeconds = (winEnd - winStart) / 1000;
  const live = liveEvents(events);
  const overlapping = live.filter((event) => eventOverlapsWindow(event, winStart, winEnd, now));

  const sleepSpans: ClippedSpan[] = [];
  const feedSpans: ClippedSpan[] = [];
  const diapers: ReportPoint[] = [];
  const pumps: ReportPoint[] = [];
  const temps: ReportPoint[] = [];
  const weights: ReportPoint[] = [];
  const vitamins: ReportPoint[] = [];
  const notes: ReportPoint[] = [];
  const tempSamples: TempSample[] = [];
  const methods: FeedMethodCounts = { breast: 0, formula: 0, expressed: 0, mixed: 0 };
  const feedStarts: number[] = [];

  let feeds = 0;
  let breastSeconds = 0;
  let bottle = 0;
  let formula = 0;
  let expressed = 0;
  let pumped = 0;
  let wet = 0;
  let dirty = 0;

  for (const event of overlapping) {
    const startMs = new Date(event.time).getTime();
    const endMs = eventEndMs(event, now);
    const clipped = clipInterval(startMs, Math.max(startMs, endMs), winStart, winEnd);
    switch (event.type) {
      case "sleep": {
        if (!clipped) break;
        sleepSpans.push({
          id: event.id,
          type: "sleep",
          startMs: clipped.startMs,
          endMs: clipped.endMs,
          inProgress: !event.endedAt,
          label: event.endedAt
            ? formatDuration((clipped.endMs - clipped.startMs) / 1000)
            : `sleeping · ${formatDuration((clipped.endMs - clipped.startMs) / 1000)}`,
        });
        break;
      }
      case "feed": {
        feeds += 1;
        const data = event.data as FeedData;
        methods[data.method] += 1;
        const split = milkSplit(data);
        formula += split.formulaMl;
        expressed += split.expressedMl;
        bottle += split.formulaMl + split.expressedMl;
        const secs = feedSeconds(data, event, now);
        const duration = clipped ? (clipped.endMs - clipped.startMs) / 1000 : 0;
        const breast = data.method === "breast" || data.method === "mixed" ? Math.min(secs.total, duration || secs.total) : 0;
        breastSeconds += breast;
        if (startMs >= winStart && startMs < winEnd) feedStarts.push(startMs);
        if (clipped && clipped.endMs - clipped.startMs >= 90_000) {
          feedSpans.push({
            id: event.id,
            type: "feed",
            startMs: clipped.startMs,
            endMs: clipped.endMs,
            inProgress: !event.endedAt,
            label: feedSpanLabel(event, settings, (clipped.endMs - clipped.startMs) / 1000),
          });
        } else {
          const at = clipped ? clipped.startMs : Math.min(Math.max(startMs, winStart), winEnd - 1);
          feedSpans.push({
            id: event.id,
            type: "feed",
            startMs: at,
            endMs: Math.min(at + 8 * 60_000, winEnd),
            inProgress: !event.endedAt,
            label: feedSpanLabel(event, settings, duration),
          });
        }
        break;
      }
      case "diaper": {
        const kind = (event.data as DiaperData).kind;
        if (kind === "wet" || kind === "both") wet += 1;
        if (kind === "dirty" || kind === "both") dirty += 1;
        diapers.push({ id: event.id, type: "diaper", atMs: startMs, label: pointLabel(event, settings, now) });
        break;
      }
      case "pump": {
        pumped += pumpMl(event.data as PumpData);
        pumps.push({ id: event.id, type: "pump", atMs: startMs, label: pointLabel(event, settings, now) });
        break;
      }
      case "temp": {
        const celsius = (event.data as TempData).celsius;
        tempSamples.push({ id: event.id, time: event.time, atMs: startMs, celsius });
        temps.push({
          id: event.id,
          type: "temp",
          atMs: startMs,
          label: formatTemp(celsius, settings.tempUnit),
        });
        break;
      }
      case "weight": {
        weights.push({ id: event.id, type: "weight", atMs: startMs, label: pointLabel(event, settings, now) });
        break;
      }
      case "note": {
        notes.push({ id: event.id, type: "note", atMs: startMs, label: pointLabel(event, settings, now) });
        break;
      }
      case "vitaminD":
      case "vitaminK": {
        vitamins.push({
          id: event.id,
          type: event.type,
          atMs: startMs,
          label: `${vitaminLabel(event.type)} · ${formatClock(event.time, settings.timezone)}`,
        });
        break;
      }
      default: {
        const _exhaustive: never = event.type;
        void _exhaustive;
      }
    }
  }

  const sleepMerged = mergeIntervals(sleepSpans);
  const sleepSeconds = intervalSeconds(sleepMerged);
  const awakeSeconds = Math.max(0, durationSeconds - sleepSeconds);
  const sleepGaps = gapMs(sleepMerged, winStart, winEnd);
  const longestSleepSeconds = sleepMerged.reduce((max, span) => Math.max(max, (span.endMs - span.startMs) / 1000), 0);
  const longestAwakeSeconds = sleepGaps.reduce((max, ms) => Math.max(max, ms / 1000), 0);

  feedStarts.sort((a, b) => a - b);
  const feedGapsMin = feedStarts.slice(1).map((t, i) => (t - feedStarts[i]) / 60_000);

  const days = careDaysOverlapping(window.start, window.end, settings.timezone, settings.careDayStartHour).map((day) => {
    const sliceStartMs = Math.max(day.start.getTime(), winStart);
    const sliceEndMs = Math.min(day.end.getTime(), winEnd);
    const sliceStart = new Date(sliceStartMs);
    const sliceEnd = new Date(sliceEndMs);
    const sliceSeconds = Math.max(1, (sliceEndMs - sliceStartMs) / 1000);
    const dayLen = Math.max(1, (day.end.getTime() - day.start.getTime()) / 1000);
    const sleepSec = intervalSeconds(sleepIntervals(live, sliceStartMs, sliceEndMs, now));
    const totals = dayTotals(live, sliceStart, sliceEnd, now);
    const vd = latestInRange(live, "vitaminD", day.start, day.end);
    const vk = latestInRange(live, "vitaminK", day.start, day.end);
    return {
      key: day.key,
      label: formatDayLabel(day, settings.timezone),
      start: day.start,
      end: day.end,
      sliceStart,
      sliceEnd,
      partial: sliceSeconds / dayLen < 0.95,
      totals,
      sleepSeconds: sleepSec,
      sleepPct: (sleepSec / sliceSeconds) * 100,
      vitaminD: Boolean(vd),
      vitaminK: Boolean(vk),
      vitaminDAt: vd ? formatClock(vd.time, settings.timezone) : null,
      vitaminKAt: vk ? formatClock(vk.time, settings.timezone) : null,
    } satisfies CareDaySlice;
  });

  const lastWeight = live
    .filter((e) => e.type === "weight")
    .sort((a, b) => (a.time < b.time ? 1 : -1))[0];

  const celsiusValues = tempSamples.map((s) => s.celsius);
  const eventLog = overlapping
    .filter((e) => {
      const t = new Date(e.time).getTime();
      return t >= winStart && t < winEnd;
    })
    .sort((a, b) => (a.time < b.time ? 1 : -1));

  return {
    hours,
    start: window.start,
    end: window.end,
    durationSeconds,
    babyName: settings.babyName || "Baby",
    timezone: settings.timezone,
    generatedAt: now,
    sleepSeconds,
    sleepPct: durationSeconds > 0 ? (sleepSeconds / durationSeconds) * 100 : 0,
    awakeSeconds,
    sleepCount: sleepSpans.length,
    longestSleepSeconds,
    longestAwakeSeconds,
    feeds,
    breastSeconds,
    methods,
    bottleMl: bottle,
    formulaMl: formula,
    expressedMl: expressed,
    pumpMl: pumped,
    wet,
    dirty,
    medianFeedGapMinutes: median(feedGapsMin),
    meanFeedGapMinutes: mean(feedGapsMin),
    fridgeMl: fridgeEstimateMl(live),
    days,
    sleepSpans,
    feedSpans,
    diapers,
    pumps,
    temps,
    weights,
    vitamins,
    notes,
    tempSamples: tempSamples.sort((a, b) => a.atMs - b.atMs),
    tempMinC: celsiusValues.length ? Math.min(...celsiusValues) : null,
    tempMaxC: celsiusValues.length ? Math.max(...celsiusValues) : null,
    lastWeightGrams: lastWeight && lastWeight.type === "weight" ? (lastWeight.data as { grams: number }).grams : null,
    lastWeightAt: lastWeight ? lastWeight.time : null,
    eventLog,
    lifetime: buildLifetimeTrends(live, settings, now),
  };
}

export function formatHours(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0h";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

export function formatPct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

export function reportFileStem(model: ReportModel) {
  const parts = zonedParts(model.generatedAt, model.timezone);
  const day = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const slug = model.babyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `baby-day-${model.hours}h-${slug || "baby"}-${day}`;
}

export function gapLabel(minutes: number | null) {
  if (minutes == null) return "—";
  return formatDuration(minutes * 60);
}
