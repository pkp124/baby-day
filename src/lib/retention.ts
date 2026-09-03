import { liveEvents } from "./domain";
import type { CareEvent } from "./types";

/** `0` means keep every event until the parent deletes it. */
export const KEEP_FOREVER_DAYS = 0;

export const RETENTION_CHOICES = [0, 90, 365, 730] as const;
export type EventRetentionDays = (typeof RETENTION_CHOICES)[number];

export function retentionCutoffIso(days: number, now = new Date()): string | null {
  if (!Number.isFinite(days) || days <= KEEP_FOREVER_DAYS) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function eventsPastRetention(events: CareEvent[], cutoffIso: string, now = new Date()): CareEvent[] {
  const cutoff = Date.parse(cutoffIso);
  if (!Number.isFinite(cutoff)) return [];
  return liveEvents(events).filter((event) => {
    const start = Date.parse(event.time);
    if (!Number.isFinite(start) || start >= cutoff) return false;
    const end = event.endedAt ? Date.parse(event.endedAt) : now.getTime();
    return Number.isFinite(end) && end < cutoff;
  });
}

export function retentionLabel(days: number) {
  switch (days) {
    case 0:
      return "Keep forever";
    case 90:
      return "90 days";
    case 365:
      return "1 year";
    case 730:
      return "2 years";
    default:
      return `${days} days`;
  }
}
