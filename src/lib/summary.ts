import type { CareEvent, FeedData, PumpData, Settings } from "./types";
import { bottleMl, dayTotals, feedSeconds, pumpMl } from "./domain";
import { careDayFor, formatClock, formatDuration } from "./time";
import { formatMl, formatWeight } from "./units";

export function pediatricSnapshot(events: CareEvent[], settings: Settings, now = new Date()) {
  const live = events.filter((e) => !e.deletedAt).sort((a, b) => (a.time < b.time ? 1 : -1));
  const from = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const window = live.filter((e) => new Date(e.time).getTime() >= from.getTime());
  const day = careDayFor(now, settings.timezone, settings.careDayStartHour);
  const today = dayTotals(live, day.start, day.end, now);
  const lastWeight = live.find((e) => e.type === "weight");

  const lines: string[] = [];
  lines.push(`${settings.babyName || "Baby"} — last 48 hours`);
  lines.push(`As of ${now.toISOString()}`);
  lines.push("");
  lines.push(
    `Today (care day from ${settings.careDayStartHour}:00): ${today.feeds} feeds, ${formatMl(today.bottleMl, settings.volumeUnit)} bottle, ${today.wet} wet / ${today.dirty} dirty, ${formatDuration(today.sleepSeconds)} sleep`,
  );
  if (lastWeight && lastWeight.type === "weight") {
    lines.push(`Last weight: ${formatWeight((lastWeight.data as { grams: number }).grams, settings.weightUnit)} at ${formatClock(lastWeight.time, settings.timezone)}`);
  }
  lines.push("");
  lines.push("Events:");
  for (const e of window) {
    lines.push(`- ${formatClock(e.time, settings.timezone)} ${describeEvent(e, settings, now)}`);
  }
  if (window.length === 0) lines.push("- none");
  return lines.join("\n");
}

export function describeEvent(event: CareEvent, settings: Settings, now = new Date()) {
  const who = event.memberName ? ` · ${event.memberName}` : "";
  switch (event.type) {
    case "feed": {
      const data = event.data as FeedData;
      const secs = feedSeconds(data, event, now);
      const bits: string[] = [];
      if (data.method === "breast" || data.method === "mixed") {
        bits.push("breast");
        if (secs.left > 0) bits.push(`L ${formatDuration(secs.left)}`);
        if (secs.right > 0) bits.push(`R ${formatDuration(secs.right)}`);
        if (data.startedOn) bits.push(`started ${data.startedOn}`);
      }
      if (data.method === "formula" || (data.formulaMl ?? 0) > 0) bits.push(`${formatMl(data.formulaMl ?? bottleMl(data), settings.volumeUnit)} formula`);
      if (data.method === "expressed" || (data.expressedMl ?? 0) > 0) bits.push(`${formatMl(data.expressedMl ?? bottleMl(data), settings.volumeUnit)} expressed`);
      if (data.method === "mixed" && data.volumeMl && !data.formulaMl && !data.expressedMl) bits.push(`${formatMl(data.volumeMl, settings.volumeUnit)} bottle`);
      if (data.note) bits.push(data.note);
      return `Feed ${bits.join(" · ")}${who}`;
    }
    case "pump": {
      const data = event.data as PumpData;
      const bits: string[] = [];
      if (data.leftMl) bits.push(`L ${formatMl(data.leftMl, settings.volumeUnit)}`);
      if (data.rightMl) bits.push(`R ${formatMl(data.rightMl, settings.volumeUnit)}`);
      if (!data.leftMl && !data.rightMl) bits.push(formatMl(pumpMl(data), settings.volumeUnit));
      return `Pump ${bits.join(" · ")}${who}`;
    }
    case "diaper": {
      const kind = (event.data as { kind: string }).kind;
      const label = kind === "both" ? "wet + dirty" : kind;
      return `Diaper ${label}${who}`;
    }
    case "sleep": {
      const dur = event.endedAt ? formatDuration((new Date(event.endedAt).getTime() - new Date(event.time).getTime()) / 1000) : "in progress";
      return `Sleep ${dur}${who}`;
    }
    case "weight":
      return `Weight ${formatWeight((event.data as { grams: number }).grams, settings.weightUnit)}${who}`;
    case "note":
      return `Note ${(event.data as { text: string }).text}${who}`;
  }
}

export function eventsToCsv(events: CareEvent[]) {
  const header = ["id", "type", "time", "endedAt", "memberName", "data"];
  const rows = events
    .filter((e) => !e.deletedAt)
    .map((e) =>
      [e.id, e.type, e.time, e.endedAt ?? "", e.memberName, JSON.stringify(e.data).replaceAll('"', '""')].map((c) => `"${c}"`).join(","),
    );
  return [header.join(","), ...rows].join("\n");
}
