export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** UTC instant of a civil datetime in a timezone. */
export function fromZonedLocal(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const parts = zonedParts(new Date(utcGuess), timeZone);
  const asIfLocal = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return new Date(utcGuess - (asIfLocal - utcGuess));
}

function addDays(y: number, m: number, d: number, delta: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export type CareDay = {
  key: string;
  start: Date;
  end: Date;
  year: number;
  month: number;
  day: number;
};

export function careDayFor(date: Date, timeZone: string, startHour: number): CareDay {
  const parts = zonedParts(date, timeZone);
  const shifted =
    parts.hour < startHour ? addDays(parts.year, parts.month, parts.day, -1) : { year: parts.year, month: parts.month, day: parts.day };
  const next = addDays(shifted.year, shifted.month, shifted.day, 1);
  const start = fromZonedLocal(timeZone, shifted.year, shifted.month, shifted.day, startHour);
  const end = fromZonedLocal(timeZone, next.year, next.month, next.day, startHour);
  const key = `${shifted.year}-${String(shifted.month).padStart(2, "0")}-${String(shifted.day).padStart(2, "0")}`;
  return { key, start, end, year: shifted.year, month: shifted.month, day: shifted.day };
}

export function formatCareDayLabel(day: CareDay, timeZone: string, startHour: number, now = new Date()) {
  const current = careDayFor(now, timeZone, startHour);
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(
    fromZonedLocal(timeZone, day.year, day.month, day.day, 12),
  );
  if (day.key === current.key) return `Today · ${date}`;
  const yest = careDayFor(new Date(current.start.getTime() - 60_000), timeZone, startHour);
  if (day.key === yest.key) return `Yesterday · ${date}`;
  return date;
}

export function formatClock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return sec > 0 && m < 3 ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

export function formatDurationClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatRelative(iso: string, now = new Date()) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem === 0 ? `${hours}h ago` : `${hours}h ${rem}m ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function minutesAgoIso(minutes: number, from = new Date()) {
  return new Date(from.getTime() - minutes * 60_000).toISOString();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Civil datetime string for `<input type="datetime-local">` in a timezone. */
export function toDatetimeLocalValue(iso: string, timeZone: string) {
  const p = zonedParts(new Date(iso), timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Parse a datetime-local value as a civil time in `timeZone`. */
export function fromDatetimeLocalValue(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return new Date().toISOString();
  return fromZonedLocal(
    timeZone,
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  ).toISOString();
}

export function eventDurationSeconds(time: string, endedAt: string | null, now = new Date()) {
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime();
  return Math.max(0, (end - new Date(time).getTime()) / 1000);
}

/** If start + duration would end in the future, slide the window so it ends now. */
export function spanFromStart(startIso: string, durationSeconds: number, now = new Date()) {
  const durationMs = Math.max(0, durationSeconds) * 1000;
  let time = startIso;
  let endedAt = new Date(new Date(time).getTime() + durationMs).toISOString();
  if (new Date(endedAt).getTime() > now.getTime()) {
    endedAt = now.toISOString();
    time = new Date(now.getTime() - durationMs).toISOString();
  }
  return { time, endedAt };
}

export function orderedInstants(a: string, b: string) {
  return new Date(a).getTime() <= new Date(b).getTime() ? ([a, b] as const) : ([b, a] as const);
}
