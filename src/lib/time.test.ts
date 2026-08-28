import { describe, expect, it } from "vitest";
import { careDayFor, formatDuration, fromDatetimeLocalValue, fromZonedLocal, minutesAgoIso, spanFromStart, toDatetimeLocalValue } from "./time";
import { feedSeconds, fridgeEstimateMl, milkSplit, nextBreastSide } from "./domain";
import { celsiusToDisplay, displayToCelsius, displayToMl, formatMl, formatTemp, mlToDisplay } from "./units";
import type { CareEvent, FeedData } from "./types";

describe("care day", () => {
  it("assigns a 1:40am feed to the previous care day when the day starts at 5am", () => {
    const tz = "America/New_York";
    const stamp = fromZonedLocal(tz, 2026, 8, 27, 1, 40);
    const day = careDayFor(stamp, tz, 5);
    expect(day.key).toBe("2026-08-26");
    expect(careDayFor(fromZonedLocal(tz, 2026, 8, 27, 5, 0), tz, 5).key).toBe("2026-08-27");
  });
});

describe("duration and units", () => {
  it("formats mixed hours and minutes", () => {
    expect(formatDuration(2 * 3600 + 10 * 60)).toBe("2h 10m");
    expect(formatDuration(45)).toBe("45s");
  });

  it("round-trips ounces to millilitres", () => {
    const ml = displayToMl(2, "oz");
    expect(mlToDisplay(ml, "oz")).toBe(2);
    expect(formatMl(60, "ml")).toBe("60 ml");
  });
});

describe("breast feed sessions", () => {
  it("accumulates the active side from sideStartedAt", () => {
    const start = new Date("2026-08-27T10:00:00.000Z");
    const now = new Date("2026-08-27T10:08:00.000Z");
    const event = {
      time: start.toISOString(),
      endedAt: null,
      data: {
        method: "breast",
        startedOn: "left",
        activeSide: "left",
        sideStartedAt: start.toISOString(),
        leftSeconds: 0,
        rightSeconds: 0,
      } satisfies FeedData,
    } as CareEvent;
    const secs = feedSeconds(event.data as FeedData, event, now);
    expect(Math.round(secs.left)).toBe(480);
    expect(secs.right).toBe(0);
  });

  it("suggests the opposite starting side next", () => {
    const events = [
      {
        deletedAt: null,
        type: "feed",
        time: minutesAgoIso(30),
        endedAt: minutesAgoIso(10),
        data: { method: "breast", startedOn: "left", leftSeconds: 600, rightSeconds: 400 },
      },
    ] as CareEvent[];
    expect(nextBreastSide(events)).toBe("right");
  });
});

describe("milk totals", () => {
  it("splits formula, expressed, and mixed bottles without double-counting volumeMl", () => {
    expect(milkSplit({ method: "formula", formulaMl: 60 })).toEqual({ formulaMl: 60, expressedMl: 0 });
    expect(milkSplit({ method: "expressed", expressedMl: 80 })).toEqual({ formulaMl: 0, expressedMl: 80 });
    expect(milkSplit({ method: "mixed", formulaMl: 30, expressedMl: 40, volumeMl: 70 })).toEqual({
      formulaMl: 30,
      expressedMl: 40,
    });
    expect(milkSplit({ method: "breast", leftSeconds: 300 })).toEqual({ formulaMl: 0, expressedMl: 0 });
  });

  it("estimates fridge milk as pumped minus expressed bottles across days", () => {
    const events = [
      {
        deletedAt: null,
        type: "pump",
        time: "2026-08-26T10:00:00.000Z",
        data: { leftMl: 50, rightMl: 50 },
      },
      {
        deletedAt: null,
        type: "feed",
        time: "2026-08-27T10:00:00.000Z",
        data: { method: "expressed", expressedMl: 40 },
      },
      {
        deletedAt: null,
        type: "feed",
        time: "2026-08-27T12:00:00.000Z",
        data: { method: "formula", formulaMl: 60 },
      },
    ] as CareEvent[];
    expect(fridgeEstimateMl(events)).toBe(60);
  });

  it("does not let the fridge estimate go negative", () => {
    const events = [
      {
        deletedAt: null,
        type: "pump",
        time: "2026-08-27T10:00:00.000Z",
        data: { volumeMl: 30 },
      },
      {
        deletedAt: null,
        type: "feed",
        time: "2026-08-27T11:00:00.000Z",
        data: { method: "expressed", expressedMl: 80 },
      },
    ] as CareEvent[];
    expect(fridgeEstimateMl(events)).toBe(0);
  });
});

describe("exact clock times", () => {
  it("round-trips a datetime-local value in UTC", () => {
    const iso = "2026-08-27T15:40:00.000Z";
    expect(toDatetimeLocalValue(iso, "UTC")).toBe("2026-08-27T15:40");
    expect(fromDatetimeLocalValue("2026-08-27T15:40", "UTC")).toBe(iso);
  });

  it("shows New York civil time for a UTC instant", () => {
    expect(toDatetimeLocalValue("2026-08-27T15:40:00.000Z", "America/New_York")).toBe("2026-08-27T11:40");
  });

  it("slides a future-ending breast log so it ends now", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const span = spanFromStart("2026-08-27T11:55:00.000Z", 20 * 60, now);
    expect(span.endedAt).toBe(now.toISOString());
    expect(span.time).toBe("2026-08-27T11:40:00.000Z");
  });

  it("keeps a past breast log window in place", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const span = spanFromStart("2026-08-27T10:00:00.000Z", 15 * 60, now);
    expect(span.time).toBe("2026-08-27T10:00:00.000Z");
    expect(span.endedAt).toBe("2026-08-27T10:15:00.000Z");
  });
});

describe("temperature units", () => {
  it("round-trips Celsius and Fahrenheit", () => {
    expect(formatTemp(37, "C")).toBe("37.0 °C");
    expect(celsiusToDisplay(37, "F")).toBe(98.6);
    expect(Math.round(displayToCelsius(98.6, "F") * 10) / 10).toBe(37);
  });
});
