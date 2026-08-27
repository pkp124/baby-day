import type { BreastSide, CareEvent, FeedData, Settings } from "../lib/types";
import { bottleMl, feedSeconds, mostRecent, nextBreastSide } from "../lib/domain";
import { formatClock, formatDuration, formatRelative } from "../lib/time";
import { formatMl, formatWeight } from "../lib/units";
import { describeEvent } from "../lib/summary";

export function TimeChips({
  minutesAgo,
  onChange,
}: {
  minutesAgo: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="timechips">
      {[0, 10, 20, 60].map((n) => (
        <button key={n} type="button" className={minutesAgo === n ? "on" : ""} onClick={() => onChange(n)}>
          {n === 0 ? "Now" : n === 60 ? "1h ago" : `${n}m ago`}
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
  const diaper = mostRecent(events, "diaper");
  const sleep = mostRecent(events, "sleep");
  const next = nextBreastSide(events);
  const feedHint = feed ? feedHintText(feed, settings, now, next) : `Next start ${next}`;
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
