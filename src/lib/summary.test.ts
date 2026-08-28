import { describe, expect, it } from "vitest";
import { describeEvent, pediatricSnapshot } from "./summary";
import { defaultSettings, type CareEvent } from "./types";

const settings = { ...defaultSettings(), babyName: "Arjun", timezone: "UTC", volumeUnit: "ml" as const, weightUnit: "kg" as const };

describe("summaries", () => {
  it("describes a mixed feed without inventing medical advice", () => {
    const event = {
      type: "feed",
      time: "2026-08-27T10:00:00.000Z",
      endedAt: "2026-08-27T10:20:00.000Z",
      memberName: "Asha",
      data: {
        method: "mixed",
        startedOn: "right",
        leftSeconds: 300,
        rightSeconds: 480,
        formulaMl: 30,
      },
    } as CareEvent;
    const text = describeEvent(event, settings);
    expect(text).toContain("breast");
    expect(text).toContain("L 5m");
    expect(text).toContain("R 8m");
    expect(text).toContain("30 ml formula");
    expect(text).toContain("Asha");
  });

  it("describes a finished sleep with start, end, and duration", () => {
    const event = {
      type: "sleep",
      time: "2026-08-27T10:00:00.000Z",
      endedAt: "2026-08-27T10:45:00.000Z",
      memberName: "Asha",
      data: {},
    } as CareEvent;
    const text = describeEvent(event, settings);
    expect(text).toContain("Sleep");
    expect(text).toContain("45m");
    expect(text).toContain("Asha");
  });

  it("describes a temperature in the family unit", () => {
    const event = {
      type: "temp",
      time: "2026-08-27T10:00:00.000Z",
      endedAt: "2026-08-27T10:00:00.000Z",
      memberName: "Asha",
      data: { celsius: 37 },
    } as CareEvent;
    expect(describeEvent(event, settings)).toContain("37.0 °C");
    expect(describeEvent(event, { ...settings, tempUnit: "F" })).toContain("98.6 °F");
  });

  it("builds a 48h snapshot with today's totals", () => {
    const events: CareEvent[] = [
      {
        id: "1",
        familyId: "f",
        babyId: "b",
        memberId: "m",
        memberName: "Asha",
        type: "diaper",
        time: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rev: 1,
        deletedAt: null,
        data: { kind: "wet" },
        syncStatus: "pending",
      },
    ];
    const text = pediatricSnapshot(events, settings);
    expect(text).toContain("Arjun — last 48 hours");
    expect(text).toContain("1 wet");
    expect(text).toContain("fed");
    expect(text).toContain("Fridge estimate:");
    expect(text).not.toContain("percentile");
  });

  it("includes last pump time in the 48h snapshot", () => {
    const events: CareEvent[] = [
      {
        id: "p1",
        familyId: "f",
        babyId: "b",
        memberId: "m",
        memberName: "Asha",
        type: "pump",
        time: "2026-08-28T10:15:00.000Z",
        endedAt: "2026-08-28T10:15:00.000Z",
        createdAt: "2026-08-28T10:15:00.000Z",
        updatedAt: "2026-08-28T10:15:00.000Z",
        rev: 1,
        deletedAt: null,
        data: { leftMl: 40, rightMl: 35 },
        syncStatus: "pending",
      },
    ];
    const text = pediatricSnapshot(events, settings, new Date("2026-08-28T12:00:00.000Z"));
    expect(text).toContain("Last pump:");
    expect(text).toContain("75 ml");
  });
});
