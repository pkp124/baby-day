import type { CareEvent } from "./types";

export function shouldApplyIncoming(local: CareEvent | undefined, incoming: CareEvent) {
  if (!local) return true;
  if (incoming.rev !== local.rev) return incoming.rev > local.rev;
  return incoming.updatedAt > local.updatedAt;
}

export function hostOnlySdp(sdp: string) {
  return filterIceCandidates(sdp, (typ) => typ === "host");
}

/** Crib video: keep LAN host plus STUN srflx so iOS mDNS `.local` hosts can reach Android. Never relay. */
export function lanMediaSdp(sdp: string) {
  return filterIceCandidates(sdp, (typ) => typ === "host" || typ === "srflx");
}

function filterIceCandidates(sdp: string, keepTyp: (typ: string) => boolean) {
  return sdp
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.startsWith("a=candidate:")) return true;
      const typ = line.match(/\styp\s(\S+)/)?.[1];
      return Boolean(typ && keepTyp(typ));
    })
    .join("\r\n");
}

export type EventDigest = { id: string; rev: number; updatedAt: string };

export function digestOf(events: CareEvent[]): EventDigest[] {
  return events.map((e) => ({ id: e.id, rev: e.rev, updatedAt: e.updatedAt }));
}

export function eventsNeeded(theirs: EventDigest[], myEvents: CareEvent[]) {
  const theirMap = new Map(theirs.map((d) => [d.id, d]));
  return myEvents.filter((event) => {
    const other = theirMap.get(event.id);
    if (!other) return true;
    return shouldApplyIncoming(
      { ...event, rev: other.rev, updatedAt: other.updatedAt },
      event,
    );
  });
}
