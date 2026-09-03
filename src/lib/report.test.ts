import { describe, expect, it } from "vitest";
import { buildReport, clipInterval, formatHours, formatPct, gapMs, mergeIntervals, normalizeReportRange, reportFileStem, reportTitle } from "./report";
import { reportHtml } from "./reportHtml";
import { darkChartTheme, ganttSvg, sleepTrendSvg, tempLineSvg } from "./reportCharts";
import { defaultSettings, type CareEvent, type EventType } from "./types";

const settings = {
  ...defaultSettings(),
  babyName: "Arjun",
  timezone: "UTC",
  careDayStartHour: 5,
  volumeUnit: "ml" as const,
  tempUnit: "C" as const,
};

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

describe("interval helpers", () => {
  it("clips a span that started before the window", () => {
    const winStart = Date.parse("2026-08-27T12:00:00.000Z");
    const winEnd = Date.parse("2026-08-30T12:00:00.000Z");
    const clipped = clipInterval(Date.parse("2026-08-27T10:00:00.000Z"), Date.parse("2026-08-27T14:00:00.000Z"), winStart, winEnd);
    expect(clipped).toEqual({
      startMs: winStart,
      endMs: Date.parse("2026-08-27T14:00:00.000Z"),
    });
  });

  it("merges overlapping sleep so percentage is not double-counted", () => {
    const merged = mergeIntervals([
      { startMs: 0, endMs: 100 },
      { startMs: 80, endMs: 150 },
      { startMs: 200, endMs: 220 },
    ]);
    expect(merged).toEqual([
      { startMs: 0, endMs: 150 },
      { startMs: 200, endMs: 220 },
    ]);
  });

  it("treats the whole window as awake when there is no sleep", () => {
    expect(gapMs([], 0, 1000)).toEqual([1000]);
  });

  it("swaps inverted timestamps and clamps the end to now", () => {
    const range = normalizeReportRange(
      new Date("2026-08-30T18:00:00.000Z"),
      new Date("2026-08-30T10:00:00.000Z"),
      now,
    );
    expect(range.start.toISOString()).toBe("2026-08-30T10:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-30T12:00:00.000Z");
    expect(range.hours).toBe(2);
  });
});

describe("72-hour report", () => {
  it("counts clipped sleep toward the 72-hour percentage", () => {
    const events = [
      event({
        id: "s1",
        type: "sleep",
        time: "2026-08-27T10:00:00.000Z",
        endedAt: "2026-08-27T14:00:00.000Z",
      }),
    ];
    const report = buildReport(events, settings, now);
    expect(report.hours).toBe(72);
    expect(report.sleepSeconds).toBe(2 * 3600);
    expect(report.sleepPct).toBeCloseTo((2 / 72) * 100, 5);
    expect(report.awakeSeconds).toBe(70 * 3600);
    expect(report.sleepCount).toBe(1);
  });

  it("does not double-count overlapping sleep stretches", () => {
    const events = [
      event({
        id: "a",
        type: "sleep",
        time: "2026-08-29T20:00:00.000Z",
        endedAt: "2026-08-30T00:00:00.000Z",
      }),
      event({
        id: "b",
        type: "sleep",
        time: "2026-08-29T22:00:00.000Z",
        endedAt: "2026-08-30T01:00:00.000Z",
      }),
    ];
    const report = buildReport(events, settings, now);
    expect(report.sleepSeconds).toBe(5 * 3600);
  });

  it("ignores deleted events and events wholly outside the window", () => {
    const events = [
      event({
        id: "old",
        type: "diaper",
        time: "2026-08-26T12:00:00.000Z",
        data: { kind: "wet" },
      }),
      event({
        id: "gone",
        type: "diaper",
        time: "2026-08-29T12:00:00.000Z",
        deletedAt: "2026-08-29T12:01:00.000Z",
        data: { kind: "dirty" },
      }),
      event({
        id: "ok",
        type: "diaper",
        time: "2026-08-29T15:00:00.000Z",
        data: { kind: "both" },
      }),
    ];
    const report = buildReport(events, settings, now);
    expect(report.wet).toBe(1);
    expect(report.dirty).toBe(1);
    expect(report.diapers).toHaveLength(1);
  });

  it("computes median feed gap from starts inside the window", () => {
    const events = [
      event({
        id: "f1",
        type: "feed",
        time: "2026-08-29T10:00:00.000Z",
        endedAt: "2026-08-29T10:20:00.000Z",
        data: { method: "breast", leftSeconds: 600, rightSeconds: 600 },
      }),
      event({
        id: "f2",
        type: "feed",
        time: "2026-08-29T13:00:00.000Z",
        endedAt: "2026-08-29T13:00:00.000Z",
        data: { method: "formula", formulaMl: 90 },
      }),
      event({
        id: "f3",
        type: "feed",
        time: "2026-08-29T16:00:00.000Z",
        endedAt: "2026-08-29T16:00:00.000Z",
        data: { method: "expressed", expressedMl: 60 },
      }),
    ];
    const report = buildReport(events, settings, now);
    expect(report.feeds).toBe(3);
    expect(report.methods).toEqual({ breast: 1, formula: 1, expressed: 1, mixed: 0 });
    expect(report.medianFeedGapMinutes).toBe(180);
    expect(report.bottleMl).toBe(150);
    expect(report.formulaMl).toBe(90);
  });

  it("tracks temperature min and max in the family unit samples", () => {
    const events = [
      event({ id: "t1", type: "temp", time: "2026-08-28T10:00:00.000Z", data: { celsius: 36.8 } }),
      event({ id: "t2", type: "temp", time: "2026-08-29T10:00:00.000Z", data: { celsius: 37.6 } }),
    ];
    const report = buildReport(events, settings, now);
    expect(report.tempMinC).toBe(36.8);
    expect(report.tempMaxC).toBe(37.6);
    expect(report.tempSamples).toHaveLength(2);
  });

  it("splits the window into care days including partial edges", () => {
    const report = buildReport([], settings, now);
    expect(report.days.length).toBeGreaterThanOrEqual(3);
    expect(report.days[0].partial).toBe(true);
    expect(report.days[report.days.length - 1].partial).toBe(true);
    expect(report.days.some((day) => !day.partial)).toBe(true);
  });

  it("includes in-progress sleep through now", () => {
    const events = [
      event({
        id: "live",
        type: "sleep",
        time: "2026-08-30T10:00:00.000Z",
        endedAt: null,
      }),
    ];
    const report = buildReport(events, settings, now);
    expect(report.sleepSeconds).toBe(2 * 3600);
    expect(report.sleepSpans[0].inProgress).toBe(true);
  });

  it("builds a printable HTML report that escapes names", () => {
    const nasty = { ...settings, babyName: `Arjun</title><script>alert(1)</script>` };
    const events = [
      event({
        id: "s1",
        type: "sleep",
        time: "2026-08-29T22:00:00.000Z",
        endedAt: "2026-08-30T04:00:00.000Z",
      }),
      event({
        id: "d1",
        type: "diaper",
        time: "2026-08-30T04:10:00.000Z",
        data: { kind: "wet" },
      }),
    ];
    const model = buildReport(events, nasty, now);
    const html = reportHtml(model, nasty);
    expect(html).toContain("Last 72 hours");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("<svg");
    expect(html).toContain("Care timeline");
    expect(html).toContain("window.print()");
    expect(html).toContain("1 wet");
    expect(html).toContain("All days");
    expect(html).toContain("Sleep hours per care day");
    expect(reportFileStem(model)).toBe("baby-day-2026-08-27-to-2026-08-30-arjun-title-script-alert-1-script");
    expect(reportTitle(model)).toBe("Last 72 hours");
  });

  it("draws sleep bars and temperature points on the gantt", () => {
    const events = [
      event({
        id: "s1",
        type: "sleep",
        time: "2026-08-29T22:00:00.000Z",
        endedAt: "2026-08-30T04:00:00.000Z",
      }),
      event({ id: "t1", type: "temp", time: "2026-08-30T06:00:00.000Z", data: { celsius: 37.2 } }),
    ];
    const model = buildReport(events, settings, now);
    const svg = ganttSvg(model, darkChartTheme);
    expect(svg).toContain("Sleep");
    expect(svg).toContain("Feed");
    expect(svg).toContain("Diaper");
    expect(svg).toContain("<rect");
    expect(svg).toContain("<circle");
    expect(tempLineSvg(model, darkChartTheme, settings)).toContain("37.2");
  });

  it("rounds sleep percentage for display", () => {
    expect(formatPct(58.4)).toBe("58%");
    expect(formatPct(58.6)).toBe("59%");
    expect(formatHours(14.24)).toBe("14.2h");
    expect(formatHours(8)).toBe("8h");
  });

  it("builds a custom timestamp window and ignores events outside it", () => {
    const events = [
      event({
        id: "before",
        type: "diaper",
        time: "2026-08-28T09:00:00.000Z",
        data: { kind: "wet" },
      }),
      event({
        id: "inside",
        type: "diaper",
        time: "2026-08-28T15:00:00.000Z",
        data: { kind: "dirty" },
      }),
      event({
        id: "after",
        type: "diaper",
        time: "2026-08-29T12:00:00.000Z",
        data: { kind: "both" },
      }),
    ];
    const range = {
      start: new Date("2026-08-28T12:00:00.000Z"),
      end: new Date("2026-08-29T00:00:00.000Z"),
    };
    const report = buildReport(events, settings, now, range);
    expect(report.hours).toBe(12);
    expect(report.wet).toBe(0);
    expect(report.dirty).toBe(1);
    expect(report.diapers).toHaveLength(1);
    expect(reportTitle(report)).toContain("→");
    expect(reportFileStem(report)).toBe("baby-day-2026-08-28-to-2026-08-29-arjun");
  });
});

describe("lifetime trends", () => {
  it("keeps days older than 72 hours and fills the gaps", () => {
    const events = [
      event({
        id: "old-sleep",
        type: "sleep",
        time: "2026-08-20T10:00:00.000Z",
        endedAt: "2026-08-20T16:00:00.000Z",
      }),
      event({
        id: "old-milk",
        type: "feed",
        time: "2026-08-20T11:00:00.000Z",
        data: { method: "formula", formulaMl: 120 },
      }),
      event({
        id: "old-diaper",
        type: "diaper",
        time: "2026-08-20T12:00:00.000Z",
        data: { kind: "wet" },
      }),
      event({
        id: "old-weight",
        type: "weight",
        time: "2026-08-21T09:00:00.000Z",
        data: { grams: 3800 },
      }),
      event({
        id: "old-temp",
        type: "temp",
        time: "2026-08-22T09:00:00.000Z",
        data: { celsius: 36.7 },
      }),
      event({
        id: "new-feed",
        type: "feed",
        time: "2026-08-30T10:00:00.000Z",
        data: { method: "formula", formulaMl: 90 },
      }),
    ];
    const report = buildReport(events, settings, now);
    expect(report.lifetime.dayCount).toBeGreaterThanOrEqual(10);
    const first = report.lifetime.days[0];
    expect(first.key).toBe("2026-08-20");
    expect(first.sleepHours).toBe(6);
    expect(first.milkMl).toBe(120);
    expect(first.diapers).toBe(1);
    const quiet = report.lifetime.days.find((day) => day.key === "2026-08-25");
    expect(quiet?.sleepHours).toBe(0);
    expect(quiet?.milkMl).toBe(0);
    expect(quiet?.diapers).toBe(0);
    expect(report.lifetime.weights).toHaveLength(1);
    expect(report.lifetime.temps[0].celsius).toBe(36.7);
    expect(report.lifetime.lastWeightGrams).toBe(3800);
    expect(report.feeds).toBe(1);
    expect(sleepTrendSvg(report.lifetime.days, darkChartTheme)).toContain("Sleep hours per care day");
  });

  it("splits overnight sleep across care days", () => {
    const events = [
      event({
        id: "overnight",
        type: "sleep",
        time: "2026-08-21T03:00:00.000Z",
        endedAt: "2026-08-21T07:00:00.000Z",
      }),
    ];
    const report = buildReport(events, settings, now);
    const d20 = report.lifetime.days.find((day) => day.key === "2026-08-20");
    const d21 = report.lifetime.days.find((day) => day.key === "2026-08-21");
    expect(d20?.sleepHours).toBe(2);
    expect(d21?.sleepHours).toBe(2);
  });
});

describe("event type coverage in the report", () => {
  const types: EventType[] = ["feed", "pump", "diaper", "sleep", "weight", "temp", "note", "vitaminD", "vitaminK"];
  it("classifies every event type without throwing", () => {
    const events = types.map((type, i) =>
      event({
        id: type,
        type,
        time: new Date(now.getTime() - (i + 1) * 60 * 60 * 1000).toISOString(),
        data:
          type === "feed"
            ? { method: "mixed", formulaMl: 20, expressedMl: 10, leftSeconds: 120, rightSeconds: 60 }
            : type === "pump"
              ? { leftMl: 20, rightMl: 15 }
              : type === "diaper"
                ? { kind: "dirty" }
                : type === "weight"
                  ? { grams: 4200 }
                  : type === "temp"
                    ? { celsius: 37.1 }
                    : type === "note"
                      ? { text: "hiccups" }
                      : {},
      }),
    );
    const report = buildReport(events, settings, now);
    expect(report.feeds).toBe(1);
    expect(report.pumpMl).toBe(35);
    expect(report.dirty).toBe(1);
    expect(report.notes).toHaveLength(1);
    expect(report.vitamins).toHaveLength(2);
    expect(report.lastWeightGrams).toBe(4200);
  });
});
