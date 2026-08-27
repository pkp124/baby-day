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
    expect(text).not.toContain("percentile");
  });
});
