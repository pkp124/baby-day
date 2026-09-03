import { describe, expect, it } from "vitest";
import type { CareEvent } from "./types";
import { eventsPastRetention, retentionCutoffIso, retentionLabel } from "./retention";

const now = new Date("2026-08-30T12:00:00.000Z");

function event(partial: Partial<CareEvent> & Pick<CareEvent, "id" | "type" | "time">): CareEvent {
  return {
    familyId: "f",
    babyId: "b",
    memberId: "m",
    memberName: "Asha",
    endedAt: partial.endedAt ?? partial.time,
    createdAt: partial.time,
    updatedAt: partial.time,
    rev: 1,
    deletedAt: null,
    data: {},
    syncStatus: "pending",
    ...partial,
  };
}

describe("retention cutoff", () => {
  it("keeps forever when days is 0", () => {
    expect(retentionCutoffIso(0, now)).toBeNull();
    expect(retentionLabel(0)).toBe("Keep forever");
  });

  it("is 90 days before now", () => {
    expect(retentionCutoffIso(90, now)).toBe("2026-06-01T12:00:00.000Z");
    expect(retentionLabel(90)).toBe("90 days");
    expect(retentionLabel(365)).toBe("1 year");
  });
});

describe("events past retention", () => {
  it("drops finished events that ended before the cutoff", () => {
    const cutoff = retentionCutoffIso(90, now)!;
    const events = [
      event({ id: "old", type: "diaper", time: "2026-05-01T12:00:00.000Z" }),
      event({ id: "kept", type: "diaper", time: "2026-08-01T12:00:00.000Z" }),
      event({
        id: "live",
        type: "sleep",
        time: "2026-05-01T12:00:00.000Z",
        endedAt: null,
      }),
      event({
        id: "gone",
        type: "note",
        time: "2026-05-01T12:00:00.000Z",
        deletedAt: "2026-05-02T12:00:00.000Z",
        data: { text: "old" },
      }),
    ];
    const doomed = eventsPastRetention(events, cutoff, now).map((e) => e.id);
    expect(doomed).toEqual(["old"]);
  });
});
