import type { BreastSide, CareEvent, FeedData, Settings, TempData } from "../lib/types";
import { bottleMl, feedSeconds, mostRecent, nextBreastSide, type DayTotals } from "../lib/domain";
import { formatClock, formatDuration, formatRelative, fromDatetimeLocalValue, minutesAgoIso, toDatetimeLocalValue } from "../lib/time";
import { formatMl, formatTemp, formatWeight } from "../lib/units";
import { describeEvent } from "../lib/summary";

export function WhenField({
  timezone,
  valueIso,
  onChangeIso,
  label = "When",
}: {
  timezone: string;
  valueIso: string;
  onChangeIso: (iso: string) => void;
  label?: string;
}) {
  const minutesAgo = Math.round((Date.now() - new Date(valueIso).getTime()) / 60_000);
  const chipMatch = [0, 10, 20, 60].find((n) => Math.abs(minutesAgo - n) <= 1);
  return (
    <>
      <div className="timechips">
        {[0, 10, 20, 60].map((n) => (
          <button
            key={n}
            type="button"
            className={chipMatch === n ? "on" : ""}
            onClick={() => onChangeIso(minutesAgoIso(n))}
          >
            {n === 0 ? "Now" : n === 60 ? "1h ago" : `${n}m ago`}
          </button>
        ))}
      </div>
      <label className="field">
        {label}
        <input
          type="datetime-local"
          step={60}
          value={toDatetimeLocalValue(valueIso, timezone)}
          onChange={(e) => {
            if (!e.target.value) return;
            onChangeIso(fromDatetimeLocalValue(e.target.value, timezone));
          }}
        />
      </label>
    </>
  );
}

export function DurationChips({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      {[5, 10, 15, 20, 30].map((n) => (
        <button key={n} type="button" className={value === n ? "on" : ""} onClick={() => onChange(n)}>
          {n}m
        </button>
      ))}
    </div>
  );
}

export function VolumeChips({
  value,
  unitLabel,
  onChange,
}: {
  value: number;
  unitLabel: string;
  onChange: (n: number) => void;
}) {
  const presets = unitLabel === "oz" ? [1, 2, 3, 4, 5] : [30, 60, 90, 120, 150];
  return (
    <div className="stepper">
      {presets.map((n) => (
        <button key={n} type="button" className={value === n ? "on" : ""} onClick={() => onChange(n)}>
          {n} {unitLabel}
        </button>
      ))}
    </div>
  );
}

export function sinceLabel(event: CareEvent | undefined, now: Date, empty: string) {
  if (!event) return empty;
  return formatRelative(event.time, now);
}

export function Glance({
  events,
  settings,
  now,
}: {
  events: CareEvent[];
  settings: Settings;
  now: Date;
}) {
  const feed = mostRecent(events, "feed");
  const pump = mostRecent(events, "pump");
  const diaper = mostRecent(events, "diaper");
  const sleep = mostRecent(events, "sleep");
  const next = nextBreastSide(events);
  const feedHint = feed ? feedHintText(feed, settings, now, next) : `Next start ${next}`;
  const pumpHint = pump ? formatClock(pump.time, settings.timezone) : "—";
  const sleepHint = sleep
    ? sleep.endedAt
      ? `nap ${formatDuration((new Date(sleep.endedAt).getTime() - new Date(sleep.time).getTime()) / 1000)}`
      : "sleeping"
    : "no naps yet";
  const diaperHint = diaper ? ((diaper.data as { kind: string }).kind === "both" ? "wet + dirty" : (diaper.data as { kind: string }).kind) : "—";

  return (
    <div className="glance">
      <div className="cell">
        <div className="kicker">Last feed</div>
        <strong>{sinceLabel(feed, now, "none yet")}</strong>
        <div className="faint">{feedHint}</div>
      </div>
      <div className="cell">
        <div className="kicker">Last pump</div>
        <strong>{sinceLabel(pump, now, "none yet")}</strong>
        <div className="faint">{pumpHint}</div>
      </div>
      <div className="cell">
        <div className="kicker">Last diaper</div>
        <strong>{sinceLabel(diaper, now, "none yet")}</strong>
        <div className="faint">{diaperHint}</div>
      </div>
      <div className="cell">
        <div className="kicker">{sleep && !sleep.endedAt ? "Sleeping" : "Awake"}</div>
        <strong>
          {sleep && !sleep.endedAt
            ? formatRelative(sleep.time, now).replace(" ago", "")
            : sleep
              ? formatRelative(sleep.endedAt ?? sleep.time, now)
              : "—"}
        </strong>
        <div className="faint">{sleepHint}</div>
      </div>
    </div>
  );
}

function feedHintText(feed: CareEvent, settings: Settings, now: Date, next: BreastSide) {
  const data = feed.data as FeedData;
  const bits: string[] = [];
  if (data.method === "breast" || data.method === "mixed") {
    const secs = feedSeconds(data, feed, now);
    if (secs.total) bits.push(formatDuration(secs.total));
    bits.push(`next ${next}`);
  }
  const ml = bottleMl(data);
  if (ml) bits.push(formatMl(ml, settings.volumeUnit));
  if (data.method === "formula") bits.push("formula");
  if (data.method === "expressed") bits.push("expressed");
  return bits.join(" · ") || data.method;
}

export function Timeline({
  events,
  settings,
  now,
  onOpen,
}: {
  events: CareEvent[];
  settings: Settings;
  now: Date;
  onOpen: (event: CareEvent) => void;
}) {
  if (events.length === 0) return <p className="empty">Nothing logged yet today. Start a feed when you are ready.</p>;
  return (
    <div className="timeline">
      {events.map((event) => (
        <button key={event.id} className="event" type="button" onClick={() => onOpen(event)}>
          <div>
            <div className="when">{formatClock(event.time, settings.timezone)}</div>
            <div className="who">{formatRelative(event.time, now)}</div>
          </div>
          <div>
            {describeEvent(event, settings, now)}
            <div className="who">{event.endedAt ? "" : "in progress"}</div>
          </div>
          <span className={`mark ${event.type}`} />
        </button>
      ))}
    </div>
  );
}

export function HandoverCard({
  events,
  settings,
  now,
  onDismiss,
}: {
  events: CareEvent[];
  settings: Settings;
  now: Date;
  onDismiss: () => void;
}) {
  if (events.length === 0) return null;
  return (
    <section className="handover">
      <h2>While you were away</h2>
      <p className="muted">{events.length} new {events.length === 1 ? "event" : "events"}</p>
      <div className="timeline" style={{ marginTop: 10 }}>
        {events.map((event) => (
          <div key={event.id} className="event">
            <div className="when">{formatClock(event.time, settings.timezone)}</div>
            <div>{describeEvent(event, settings, now)}</div>
            <span className={`mark ${event.type}`} />
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="secondary grow" type="button" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </section>
  );
}

export function WeightLine({ events, settings }: { events: CareEvent[]; settings: Settings }) {
  const last = mostRecent(events, "weight");
  if (!last || last.type !== "weight") return null;
  return (
    <div className="chip">Weight {formatWeight((last.data as { grams: number }).grams, settings.weightUnit)}</div>
  );
}

export function TempLine({ events, settings }: { events: CareEvent[]; settings: Settings }) {
  const last = mostRecent(events, "temp");
  if (!last || last.type !== "temp") return null;
  return <div className="chip">Temp {formatTemp((last.data as TempData).celsius, settings.tempUnit)}</div>;
}

export function MilkCard({
  today,
  fridgeMl,
  unit,
}: {
  today: Pick<DayTotals, "fedMl" | "formulaMl" | "expressedMl" | "pumpMl">;
  fridgeMl: number;
  unit: Settings["volumeUnit"];
}) {
  return (
    <section className="milk">
      <div className="kicker">Milk</div>
      <div className="glance">
        <div className="cell">
          <div className="kicker">Fed</div>
          <strong>{formatMl(today.fedMl, unit)}</strong>
          <div className="faint">bottles today</div>
        </div>
        <div className="cell">
          <div className="kicker">Formula</div>
          <strong>{formatMl(today.formulaMl, unit)}</strong>
          <div className="faint">today</div>
        </div>
        <div className="cell">
          <div className="kicker">Pumped</div>
          <strong>{formatMl(today.pumpMl, unit)}</strong>
          <div className="faint">today</div>
        </div>
        <div className="cell">
          <div className="kicker">Fridge</div>
          <strong>{formatMl(fridgeMl, unit)}</strong>
          <div className="faint">pumped minus expressed</div>
        </div>
      </div>
    </section>
  );
}
