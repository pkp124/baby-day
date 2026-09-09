import { describe, expect, it } from "vitest";
import {
  lastBottleFeed,
  lastBottleMlForMethod,
  lastBreastMinutes,
  lastFinishedSleepMinutes,
  lastPumpMl,
  lastTempCelsius,
  lastWeightGrams,
  latestInRange,
  vitaminLabel,
} from "./domain";
import type { CareEvent, FeedData } from "./types";

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

describe("last logged values", () => {
  it("finds the newest bottle and its millilitres for that method", () => {
    const events = [
      event({
        id: "old",
        type: "feed",
        time: "2026-08-29T08:00:00.000Z",
        data: { method: "formula", volumeMl: 60, formulaMl: 60 } satisfies FeedData,
      }),
      event({
        id: "new",
        type: "feed",
        time: "2026-08-29T12:00:00.000Z",
        data: { method: "formula", volumeMl: 90, formulaMl: 90 } satisfies FeedData,
      }),
      event({
        id: "breast",
        type: "feed",
        time: "2026-08-29T13:00:00.000Z",
        data: { method: "breast", startedOn: "left", leftSeconds: 600 } satisfies FeedData,
      }),
    ];
    expect(lastBottleFeed(events)?.id).toBe("new");
    expect(lastBottleMlForMethod(events, "formula")).toBe(90);
    expect(lastBottleMlForMethod(events, "expressed")).toBeUndefined();
  });

  it("prefills pump, weight, temp, breast minutes, and last nap length", () => {
    const events = [
      event({ id: "pump", type: "pump", time: "2026-08-29T09:00:00.000Z", data: { leftMl: 40, rightMl: 50 } }),
      event({ id: "weight", type: "weight", time: "2026-08-29T10:00:00.000Z", data: { grams: 4200 } }),
      event({ id: "temp", type: "temp", time: "2026-08-29T11:00:00.000Z", data: { celsius: 37.4 } }),
      event({
        id: "breast",
        type: "feed",
        time: "2026-08-29T12:00:00.000Z",
        data: { method: "breast", startedOn: "right", leftSeconds: 480, rightSeconds: 720 } satisfies FeedData,
      }),
      event({
        id: "nap",
        type: "sleep",
        time: "2026-08-29T14:00:00.000Z",
        endedAt: "2026-08-29T14:35:00.000Z",
      }),
    ];
    expect(lastPumpMl(events)).toEqual({ leftMl: 40, rightMl: 50 });
    expect(lastWeightGrams(events)).toBe(4200);
    expect(lastTempCelsius(events)).toBe(37.4);
    expect(lastBreastMinutes(events)).toEqual({ left: 8, right: 12, startedOn: "right" });
    expect(lastFinishedSleepMinutes(events)).toBe(35);
  });

  it("ignores deleted events and empty pump rows", () => {
    const events = [
      event({
        id: "gone",
        type: "feed",
        time: "2026-08-29T12:00:00.000Z",
        deletedAt: "2026-08-29T12:01:00.000Z",
        data: { method: "formula", volumeMl: 120, formulaMl: 120 } satisfies FeedData,
      }),
      event({ id: "empty-pump", type: "pump", time: "2026-08-29T13:00:00.000Z", data: { leftMl: 0, rightMl: 0 } }),
    ];
    expect(lastBottleFeed(events)).toBeUndefined();
    expect(lastPumpMl(events)).toBeUndefined();
  });
});
