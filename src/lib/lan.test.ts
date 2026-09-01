import { describe, expect, it } from "vitest";
import { digestOf, eventsNeeded, hostOnlySdp, lanMediaSdp, shouldApplyIncoming } from "./lanMerge";
import type { CareEvent } from "./types";

function event(partial: Partial<CareEvent> & Pick<CareEvent, "id" | "rev" | "updatedAt">): CareEvent {
  return {
    familyId: "f",
    babyId: "b",
    memberId: "m",
    memberName: "Asha",
    type: "note",
    time: "2026-08-27T10:00:00.000Z",
    endedAt: "2026-08-27T10:00:00.000Z",
    createdAt: "2026-08-27T10:00:00.000Z",
    deletedAt: null,
    data: { text: "x" },
    syncStatus: "pending",
    ...partial,
  };
}

describe("LAN merge", () => {
  it("applies a missing event and a newer revision", () => {
    expect(shouldApplyIncoming(undefined, event({ id: "1", rev: 1, updatedAt: "a" }))).toBe(true);
    const local = event({ id: "1", rev: 1, updatedAt: "2026-08-27T10:00:00.000Z" });
    const newer = event({ id: "1", rev: 2, updatedAt: "2026-08-27T11:00:00.000Z" });
    expect(shouldApplyIncoming(local, newer)).toBe(true);
    expect(shouldApplyIncoming(newer, local)).toBe(false);
  });

  it("sends events the peer does not have or has stale", () => {
    const mine = [
      event({ id: "a", rev: 2, updatedAt: "2" }),
      event({ id: "b", rev: 1, updatedAt: "1" }),
    ];
    const theirs = digestOf([event({ id: "a", rev: 1, updatedAt: "1" })]);
    const needed = eventsNeeded(theirs, mine);
    expect(needed.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });
});

describe("host-only ICE", () => {
  it("drops srflx and relay candidates so traffic cannot use a TURN server", () => {
    const sdp = [
      "v=0",
      "a=candidate:1 1 udp 1 192.168.1.8 9 typ host",
      "a=candidate:2 1 udp 1 1.2.3.4 9 typ srflx raddr 192.168.1.8",
      "a=candidate:3 1 udp 1 10.0.0.1 9 typ relay",
      "",
    ].join("\r\n");
    const next = hostOnlySdp(sdp);
    expect(next).toContain("typ host");
    expect(next).not.toContain("typ srflx");
    expect(next).not.toContain("typ relay");
  });
});

describe("crib media ICE", () => {
  it("keeps host and srflx and drops relay", () => {
    const sdp = [
      "v=0",
      "a=candidate:1 1 udp 1 192.168.1.8 9 typ host",
      "a=candidate:2 1 udp 1 1.2.3.4 9 typ srflx raddr 192.168.1.8",
      "a=candidate:3 1 udp 1 10.0.0.1 9 typ relay",
      "",
    ].join("\r\n");
    const next = lanMediaSdp(sdp);
    expect(next).toContain("typ host");
    expect(next).toContain("typ srflx");
    expect(next).not.toContain("typ relay");
  });
});
