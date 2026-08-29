import { describe, expect, it } from "vitest";
import { latestInRange, vitaminLabel } from "./domain";
import type { CareEvent } from "./types";

function event(partial: Partial<CareEvent> & Pick<CareEvent, "id" | "type" | "time">): CareEvent {
  return {
    familyId: "f",
    babyId: "b",
    memberId: "m",
    memberName: "Asha",
    endedAt: partial.time,
    createdAt: partial.time,
    updatedAt: partial.time,
    rev: 1,
    deletedAt: null,
    data: {},
    syncStatus: "pending",
    ...partial,
  };
}

describe("vitamin cards", () => {
  const start = new Date("2026-08-29T05:00:00.000Z");
  const end = new Date("2026-08-30T05:00:00.000Z");

  it("labels D and K", () => {
    expect(vitaminLabel("vitaminD")).toBe("Vitamin D");
    expect(vitaminLabel("vitaminK")).toBe("Vitamin K");
  });

  it("is missing until a dose is logged in the care day", () => {
    const events = [
      event({ id: "old", type: "vitaminD", time: "2026-08-28T12:00:00.000Z" }),
      event({ id: "k", type: "vitaminK", time: "2026-08-29T08:00:00.000Z" }),
    ];
    expect(latestInRange(events, "vitaminD", start, end)).toBeUndefined();
    expect(latestInRange(events, "vitaminK", start, end)?.id).toBe("k");
  });

  it("uses the latest live dose in the care day", () => {
    const events = [
      event({ id: "first", type: "vitaminD", time: "2026-08-29T08:00:00.000Z" }),
      event({ id: "second", type: "vitaminD", time: "2026-08-29T18:00:00.000Z" }),
      event({ id: "gone", type: "vitaminD", time: "2026-08-29T20:00:00.000Z", deletedAt: "2026-08-29T20:01:00.000Z" }),
    ];
    expect(latestInRange(events, "vitaminD", start, end)?.id).toBe("second");
  });
});
